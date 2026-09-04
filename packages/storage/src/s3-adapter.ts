import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
  CreateBucketCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

export interface S3AdapterConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** MinIO and most S3-compatible providers require path-style addressing. */
  forcePathStyle?: boolean;
}

export interface ObjectSummary {
  key: string;
  sizeBytes: number;
  lastModified: Date | undefined;
}

/**
 * Thin, provider-agnostic wrapper around the AWS S3 SDK. Pointed at MinIO for
 * local development; swapping to Cloudflare R2 or real S3 in production is a
 * config-only change (endpoint + credentials), per the platform's
 * S3-compatible object storage requirement.
 */
export class S3Adapter {
  private readonly client: S3Client;

  constructor(config: S3AdapterConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: config.forcePathStyle ?? true,
    });
  }

  async ensureBucket(bucket: string): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
  }

  async putObject(
    bucket: string,
    key: string,
    body: Buffer | Uint8Array | string,
    contentType?: string,
  ): Promise<void> {
    const input: PutObjectCommandInput = { Bucket: bucket, Key: key, Body: body, ContentType: contentType };
    await this.client.send(new PutObjectCommand(input));
  }

  async getObjectBuffer(bucket: string, key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const stream = res.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  async listObjects(bucket: string, prefix: string): Promise<ObjectSummary[]> {
    const res = await this.client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, Delimiter: "/" }),
    );
    return (res.Contents ?? [])
      .filter((o) => o.Key !== prefix)
      .map((o) => ({ key: o.Key!, sizeBytes: o.Size ?? 0, lastModified: o.LastModified }));
  }

  async getSignedDownloadUrl(bucket: string, key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async getSignedUploadUrl(bucket: string, key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new PutObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
