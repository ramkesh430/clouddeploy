import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import crypto from "node:crypto";
import { decryptSecretWithFallback, encryptSecret, generateTotpSecret, hashPassword, verifyTotp } from "@clouddeploy/security";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SecuritySettingsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async overview(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, sessions: { where: { revokedAt: null }, select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true } }, loginEvents: { orderBy: { createdAt: "desc" }, take: 20 }, _count: { select: { recoveryCodes: { where: { usedAt: null } } } } },
    });
    return user;
  }

  async beginTwoFactor(userId: string, email: string) {
    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: encryptSecret(secret, this.key()), twoFactorEnabled: false } });
    return { secret, otpauthUrl: `otpauth://totp/CloudDeploy:${encodeURIComponent(email)}?secret=${secret}&issuer=CloudDeploy&algorithm=SHA1&digits=6&period=30` };
  }

  async enableTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) throw new BadRequestException("Start two-factor setup first");
    const secret = decryptSecretWithFallback(user.twoFactorSecret, this.key(), this.previousKey());
    if (!verifyTotp(secret, code)) throw new BadRequestException("Invalid authenticator code");
    const recoveryCodes = Array.from({ length: 10 }, () => crypto.randomBytes(6).toString("hex").toUpperCase());
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
      await tx.recoveryCode.deleteMany({ where: { userId } });
      for (const codeValue of recoveryCodes) await tx.recoveryCode.create({ data: { userId, codeHash: await hashPassword(codeValue) } });
    });
    return { enabled: true, recoveryCodes };
  }

  async disableTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret || !verifyTotp(decryptSecretWithFallback(user.twoFactorSecret, this.key(), this.previousKey()), code)) throw new BadRequestException("Invalid authenticator code");
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null } }),
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
    ]);
    return { enabled: false };
  }

  async revokeOtherSessions(userId: string, currentRefreshToken?: string) {
    const result = await this.prisma.session.updateMany({ where: { userId, revokedAt: null, ...(currentRefreshToken ? { refreshToken: { not: currentRefreshToken } } : {}) }, data: { revokedAt: new Date() } });
    return { revoked: result.count };
  }

  private key() { return this.config.getOrThrow<string>("ENCRYPTION_KEY"); }
  private previousKey() { return this.config.get<string>("ENCRYPTION_KEY_PREVIOUS"); }
}
