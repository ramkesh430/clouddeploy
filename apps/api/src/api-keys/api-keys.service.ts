import { Injectable, NotFoundException } from "@nestjs/common";
import { generateApiKey, hashApiKey } from "@clouddeploy/security";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../activity-log/activity-log.service";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.aPIKey.findMany({
      where: { organizationId, revokedAt: null },
      select: {
        id: true,
        name: true,
        prefix: true,
        permissions: true,
        lastUsedAt: true,
        createdAt: true,
        user: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(dto: CreateApiKeyDto, userId: string) {
    const { prefix, full } = generateApiKey();
    const keyHash = hashApiKey(full);

    const row = await this.prisma.aPIKey.create({
      data: {
        organizationId: dto.organizationId,
        userId,
        name: dto.name,
        prefix,
        keyHash,
        permissions: dto.permissions,
      },
    });

    await this.activityLog.log({
      organizationId: dto.organizationId,
      userId,
      action: "api_key.created",
      resourceType: "APIKey",
      resourceId: row.id,
    });

    // The full key is only ever returned here, at creation time — only the
    // hash is stored, so it can never be displayed again after this.
    return { id: row.id, name: row.name, prefix: row.prefix, permissions: row.permissions, key: full };
  }

  async revoke(apiKeyId: string) {
    const key = await this.prisma.aPIKey.findUnique({ where: { id: apiKeyId } });
    if (!key) throw new NotFoundException("API key not found");
    await this.prisma.aPIKey.update({ where: { id: apiKeyId }, data: { revokedAt: new Date() } });
    return { revoked: true };
  }
}
