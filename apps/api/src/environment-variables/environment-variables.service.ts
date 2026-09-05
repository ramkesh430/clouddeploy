import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { encryptSecret, decryptSecretWithFallback, maskSecret } from "@clouddeploy/security";
import { EnvironmentTarget } from "@clouddeploy/database";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEnvVarDto } from "./dto/create-env-var.dto";
import { BulkImportEnvDto } from "./dto/bulk-import-env.dto";

@Injectable()
export class EnvironmentVariablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(projectId: string, filters: { serviceId?: string; environment?: EnvironmentTarget }) {
    const rows = await this.prisma.environmentVariable.findMany({
      where: { projectId, serviceId: filters.serviceId, environment: filters.environment },
      include: { service: { select: { id: true, name: true } } },
      orderBy: { key: "asc" },
    });
    return rows.map((row) => this.toMaskedDto(row));
  }

  async reveal(envVarId: string) {
    const row = await this.prisma.environmentVariable.findUnique({ where: { id: envVarId } });
    if (!row) throw new NotFoundException("Environment variable not found");
    return { id: row.id, key: row.key, value: decryptSecretWithFallback(row.valueCipher, this.encryptionKey(), this.previousEncryptionKey()) };
  }

  async create(dto: CreateEnvVarDto, updatedBy: string) {
    const existing = await this.prisma.environmentVariable.findUnique({
      where: {
        projectId_serviceId_environment_key: {
          projectId: dto.projectId,
          serviceId: dto.serviceId ?? null,
          environment: dto.environment ?? "PRODUCTION",
          key: dto.key,
        } as never,
      },
    }).catch(() => null);

    const data = {
      projectId: dto.projectId,
      serviceId: dto.serviceId,
      environment: dto.environment ?? "PRODUCTION",
      key: dto.key,
      valueCipher: encryptSecret(dto.value, this.encryptionKey()),
      isSecret: dto.isSecret ?? true,
      updatedBy,
    };

    if (existing) {
      throw new ConflictException(`${dto.key} is already defined for this scope`);
    }

    const row = await this.prisma.environmentVariable.create({ data });
    return this.toMaskedDto(row);
  }

  async update(envVarId: string, value: string, updatedBy: string) {
    await this.assertExists(envVarId);
    const row = await this.prisma.environmentVariable.update({
      where: { id: envVarId },
      data: { valueCipher: encryptSecret(value, this.encryptionKey()), updatedBy },
    });
    return this.toMaskedDto(row);
  }

  async remove(envVarId: string) {
    await this.assertExists(envVarId);
    await this.prisma.environmentVariable.delete({ where: { id: envVarId } });
    return { removed: true };
  }

  async bulkImport(dto: BulkImportEnvDto, updatedBy: string) {
    const parsed = this.parseDotEnv(dto.raw);
    const results = [];
    for (const [key, value] of Object.entries(parsed)) {
      const row = await this.prisma.environmentVariable.upsert({
        where: {
          projectId_serviceId_environment_key: {
            projectId: dto.projectId,
            serviceId: dto.serviceId ?? null,
            environment: dto.environment ?? "PRODUCTION",
            key,
          } as never,
        },
        create: {
          projectId: dto.projectId,
          serviceId: dto.serviceId,
          environment: dto.environment ?? "PRODUCTION",
          key,
          valueCipher: encryptSecret(value, this.encryptionKey()),
          updatedBy,
        },
        update: { valueCipher: encryptSecret(value, this.encryptionKey()), updatedBy },
      });
      results.push(this.toMaskedDto(row));
    }
    return results;
  }

  private parseDotEnv(raw: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (/^[A-Z][A-Z0-9_]*$/.test(key)) result[key] = value;
    }
    return result;
  }

  private toMaskedDto(row: {
    id: string;
    key: string;
    valueCipher: string;
    isSecret: boolean;
    environment: string;
    serviceId: string | null;
    updatedAt: Date;
  }) {
    let displayValue = maskSecret("••••••••");
    if (!row.isSecret) {
      try {
        displayValue = decryptSecretWithFallback(row.valueCipher, this.encryptionKey(), this.previousEncryptionKey());
      } catch {
        displayValue = maskSecret("••••••••");
      }
    }
    return {
      id: row.id,
      key: row.key,
      value: displayValue,
      isSecret: row.isSecret,
      environment: row.environment,
      serviceId: row.serviceId,
      updatedAt: row.updatedAt,
    };
  }

  private async assertExists(envVarId: string) {
    const row = await this.prisma.environmentVariable.findUnique({ where: { id: envVarId } });
    if (!row) throw new NotFoundException("Environment variable not found");
    return row;
  }

  private encryptionKey(): string {
    return this.config.getOrThrow<string>("ENCRYPTION_KEY");
  }

  private previousEncryptionKey(): string | undefined {
    return this.config.get<string>("ENCRYPTION_KEY_PREVIOUS");
  }
}
