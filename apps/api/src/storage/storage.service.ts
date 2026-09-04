import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Adapter } from "@clouddeploy/storage";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBucketDto } from "./dto/create-bucket.dto";

@Injectable()
export class StorageService {
  private s3: S3Adapter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private getS3(): S3Adapter {
    if (!this.s3) {
      this.s3 = new S3Adapter({
        endpoint: this.config.getOrThrow("S3_ENDPOINT"),
        region: this.config.get("S3_REGION") ?? "us-east-1",
        accessKeyId: this.config.getOrThrow("S3_ACCESS_KEY"),
        secretAccessKey: this.config.getOrThrow("S3_SECRET_KEY"),
      });
    }
    return this.s3;
  }

  /** The real, physical MinIO/S3 bucket a StorageBucket row maps to. */
  private physicalBucket(bucket: { organizationId: string; name: string }): string {
    return `org-${bucket.organizationId.toLowerCase()}-${bucket.name}`.slice(0, 63);
  }

  async listBuckets(organizationId: string) {
    const buckets = await this.prisma.storageBucket.findMany({
      where: { organizationId },
      include: { _count: { select: { objects: true } } },
      orderBy: { createdAt: "desc" },
    });
    const withUsage = await Promise.all(
      buckets.map(async (b) => {
        const agg = await this.prisma.storageObject.aggregate({
          where: { bucketId: b.id },
          _sum: { sizeBytes: true },
        });
        return { ...b, totalSizeBytes: Number(agg._sum.sizeBytes ?? 0) };
      }),
    );
    return withUsage;
  }

  async createBucket(dto: CreateBucketDto) {
    const existing = await this.prisma.storageBucket.findUnique({
      where: { organizationId_name: { organizationId: dto.organizationId, name: dto.name } },
    });
    if (existing) throw new ConflictException("A bucket with this name already exists");

    const bucket = await this.prisma.storageBucket.create({
      data: { organizationId: dto.organizationId, name: dto.name, isPublic: dto.isPublic ?? false },
    });
    await this.getS3().ensureBucket(this.physicalBucket(bucket));
    return bucket;
  }

  async getBucket(bucketId: string) {
    const bucket = await this.prisma.storageBucket.findUnique({ where: { id: bucketId } });
    if (!bucket) throw new NotFoundException("Bucket not found");
    return bucket;
  }

  async listObjects(bucketId: string, prefix = "") {
    const bucket = await this.getBucket(bucketId);
    const rows = await this.prisma.storageObject.findMany({
      where: { bucketId, key: { startsWith: prefix } },
      orderBy: { key: "asc" },
    });

    // Fold the flat key list into one level of folder/file entries under `prefix`.
    const folders = new Set<string>();
    const files: typeof rows = [];
    for (const row of rows) {
      const rest = row.key.slice(prefix.length);
      const slashIndex = rest.indexOf("/");
      if (slashIndex === -1) {
        files.push(row);
      } else {
        folders.add(prefix + rest.slice(0, slashIndex + 1));
      }
    }

    return {
      bucket,
      folders: Array.from(folders).sort(),
      files: files.map((f) => ({
        id: f.id,
        key: f.key,
        name: f.key.slice(prefix.length),
        sizeBytes: Number(f.sizeBytes),
        contentType: f.contentType,
        isPublic: f.isPublic,
        updatedAt: f.updatedAt,
      })),
    };
  }

  async createFolder(bucketId: string, key: string) {
    const bucket = await this.getBucket(bucketId);
    const normalizedKey = key.endsWith("/") ? key : `${key}/`;
    await this.getS3().putObject(this.physicalBucket(bucket), normalizedKey, "");
    return this.prisma.storageObject.upsert({
      where: { bucketId_key: { bucketId, key: normalizedKey } },
      create: { bucketId, key: normalizedKey, sizeBytes: BigInt(0), contentType: "application/x-directory" },
      update: {},
    });
  }

  async uploadObject(
    bucketId: string,
    key: string,
    file: { buffer: Buffer; mimetype: string; size: number },
    uploadedBy: string,
  ) {
    const bucket = await this.getBucket(bucketId);
    if (file.size > bucket.maxFileSizeMb * 1024 * 1024) {
      throw new BadRequestException(`File exceeds the ${bucket.maxFileSizeMb}MB limit for this bucket`);
    }
    if (
      bucket.allowedMimeTypes.length > 0 &&
      !bucket.allowedMimeTypes.some((t) => file.mimetype === t || file.mimetype.startsWith(t.replace("*", "")))
    ) {
      throw new BadRequestException(`Content type "${file.mimetype}" is not allowed in this bucket`);
    }

    await this.getS3().putObject(this.physicalBucket(bucket), key, file.buffer, file.mimetype);

    return this.prisma.storageObject.upsert({
      where: { bucketId_key: { bucketId, key } },
      create: {
        bucketId,
        key,
        sizeBytes: BigInt(file.size),
        contentType: file.mimetype,
        isPublic: bucket.isPublic,
        uploadedBy,
      },
      update: { sizeBytes: BigInt(file.size), contentType: file.mimetype, uploadedBy },
    });
  }

  async getSignedUrl(bucketId: string, objectId: string) {
    const bucket = await this.getBucket(bucketId);
    const object = await this.prisma.storageObject.findFirst({ where: { id: objectId, bucketId } });
    if (!object) throw new NotFoundException("Object not found");
    const url = await this.getS3().getSignedDownloadUrl(this.physicalBucket(bucket), object.key);
    return { url, expiresInSeconds: 3600 };
  }

  async deleteObject(bucketId: string, objectId: string) {
    const bucket = await this.getBucket(bucketId);
    const object = await this.prisma.storageObject.findFirst({ where: { id: objectId, bucketId } });
    if (!object) throw new NotFoundException("Object not found");
    await this.getS3().deleteObject(this.physicalBucket(bucket), object.key);
    await this.prisma.storageObject.delete({ where: { id: objectId } });
    return { deleted: true };
  }

  async deleteBucket(bucketId: string) {
    const bucket = await this.getBucket(bucketId);
    const objects = await this.prisma.storageObject.findMany({ where: { bucketId } });
    const s3 = this.getS3();
    await Promise.all(objects.map((o) => s3.deleteObject(this.physicalBucket(bucket), o.key).catch(() => undefined)));
    await this.prisma.storageObject.deleteMany({ where: { bucketId } });
    await this.prisma.storageBucket.delete({ where: { id: bucketId } });
    return { deleted: true };
  }

  async updateSecurity(bucketId: string, patch: { isPublic?: boolean; maxFileSizeMb?: number; allowedMimeTypes?: string[]; corsOrigins?: string[] }) {
    await this.getBucket(bucketId);
    return this.prisma.storageBucket.update({ where: { id: bucketId }, data: patch });
  }
}
