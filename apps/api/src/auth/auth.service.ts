import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import crypto from "node:crypto";
import { decryptSecret, hashPassword, verifyPassword, verifyTotp } from "@clouddeploy/security";
import { JwtPayload, AuthTokens } from "@clouddeploy/types";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        fullName: dto.fullName,
        passwordHash,
      },
    });

    const verificationToken = await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        token: crypto.randomBytes(32).toString("hex"),
        type: "EMAIL_VERIFICATION",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // In production this dispatches a transactional email. Logged here so
    // the flow is testable end-to-end without an email provider configured.
    const tokens = await this.issueTokens(user.id, user.email);
    return {
      user: this.toPublicUser(user),
      tokens,
      emailVerificationToken: verificationToken.token,
    };
  }

  async login(dto: LoginDto, meta: { ipAddress?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        `Too many failed attempts. Try again after ${user.lockedUntil.toISOString()}`,
      );
    }

    const valid = await verifyPassword(dto.password, user.passwordHash);
    if (!valid) {
      await this.registerFailedLogin(user.id);
      await this.recordLogin(user.id, meta, false, false, "INVALID_PASSWORD");
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.isSuspended) {
      await this.recordLogin(user.id, meta, false, false, "ACCOUNT_SUSPENDED");
      throw new UnauthorizedException("This account has been suspended");
    }

    if (user.twoFactorEnabled) {
      if (!dto.otpCode || !(await this.verifySecondFactor(user.id, user.twoFactorSecret, dto.otpCode))) {
        await this.recordLogin(user.id, meta, false, false, dto.otpCode ? "INVALID_SECOND_FACTOR" : "SECOND_FACTOR_REQUIRED");
        throw new UnauthorizedException(dto.otpCode ? "Invalid two-factor code" : "Two-factor code required");
      }
    }

    const suspicious = !!user.lastLoginIp && !!meta.ipAddress && user.lastLoginIp !== meta.ipAddress;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: meta.ipAddress,
      },
    });

    await this.recordLogin(user.id, meta, true, suspicious, suspicious ? "NEW_IP_ADDRESS" : undefined);
    if (suspicious) await this.notifySuspiciousLogin(user.id, meta.ipAddress);

    const tokens = await this.issueTokens(user.id, user.email, meta);
    return { user: this.toPublicUser(user), tokens };
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    if (payload.type !== "refresh") {
      throw new UnauthorizedException("Invalid token type");
    }

    const session = await this.prisma.session.findUnique({ where: { refreshToken } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Session is no longer valid");
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.deletedAt || user.isSuspended) {
      throw new UnauthorizedException("Account is not active");
    }

    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    const tokens = await this.issueTokens(user.id, user.email, {
      userAgent: session.userAgent ?? undefined,
      ipAddress: session.ipAddress ?? undefined,
    });
    return { user: this.toPublicUser(user), tokens };
  }

  async logout(refreshToken: string) {
    await this.prisma.session.updateMany({
      where: { refreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { loggedOut: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, fullName: true, avatarUrl: true, emailVerifiedAt: true,
        isPlatformAdmin: true, twoFactorEnabled: true, createdAt: true,
        organizationMembers: { where: { status: "ACTIVE" }, include: { organization: { select: { id: true, name: true, slug: true, isAgency: true } } } },
      },
    });
    if (!user) throw new UnauthorizedException("Account is not active");
    return { ...this.toPublicUser(user), isPlatformAdmin: user.isPlatformAdmin, organizations: user.organizationMembers.map((membership) => ({ ...membership.organization, role: membership.role })) };
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.verificationToken.findUnique({ where: { token } });
    if (!record || record.type !== "EMAIL_VERIFICATION" || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException("This verification link is invalid or has expired");
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
      this.prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    return { verified: true };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Always return success shape — never reveal whether an email is registered.
    if (!user) return { sent: true };

    const token = await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        token: crypto.randomBytes(32).toString("hex"),
        type: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return { sent: true, resetToken: token.token };
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.prisma.verificationToken.findUnique({ where: { token } });
    if (!record || record.type !== "PASSWORD_RESET" || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException("This reset link is invalid or has expired");
    }
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { reset: true };
  }

  private async registerFailedLogin(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) },
      });
    }
  }

  private async issueTokens(
    userId: string,
    email: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<AuthTokens> {
    const accessPayload: JwtPayload = { sub: userId, email, type: "access" };
    const refreshPayload: JwtPayload = { sub: userId, email, type: "refresh" };

    const accessExpiry = this.config.get<string>("JWT_ACCESS_EXPIRY") ?? "15m";
    const refreshExpiry = this.config.get<string>("JWT_REFRESH_EXPIRY") ?? "30d";

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.getOrThrow<string>("JWT_SECRET"),
      expiresIn: accessExpiry,
    });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      expiresIn: refreshExpiry,
    });

    await this.prisma.session.create({
      data: {
        userId,
        refreshToken,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn: 15 * 60 };
  }

  private async verifySecondFactor(userId: string, secretCipher: string | null, code: string) {
    if (secretCipher && /^\d{6}$/.test(code)) {
      try {
        if (verifyTotp(decryptSecret(secretCipher, this.config.getOrThrow<string>("ENCRYPTION_KEY")), code)) return true;
      } catch { /* fall through to recovery codes */ }
    }
    const recoveryCodes = await this.prisma.recoveryCode.findMany({ where: { userId, usedAt: null } });
    for (const recovery of recoveryCodes) {
      if (await verifyPassword(code.toUpperCase(), recovery.codeHash)) {
        await this.prisma.recoveryCode.update({ where: { id: recovery.id }, data: { usedAt: new Date() } });
        return true;
      }
    }
    return false;
  }

  private recordLogin(userId: string, meta: { ipAddress?: string; userAgent?: string }, successful: boolean, suspicious: boolean, reason?: string) {
    return this.prisma.loginEvent.create({ data: { userId, ipAddress: meta.ipAddress, userAgent: meta.userAgent, successful, suspicious, reason } });
  }

  private async notifySuspiciousLogin(userId: string, ipAddress?: string) {
    const memberships = await this.prisma.organizationMember.findMany({ where: { userId, status: "ACTIVE" }, select: { organizationId: true } });
    if (!memberships.length) return;
    await this.prisma.notification.createMany({ data: memberships.map((membership) => ({ organizationId: membership.organizationId, userId, type: "SUSPICIOUS_LOGIN" as const, title: "New sign-in location", message: `A sign-in from ${ipAddress ?? "an unknown IP address"} was detected. Review active sessions if this was not you.` })) });
  }

  private toPublicUser(user: { id: string; email: string; fullName: string; avatarUrl: string | null; emailVerifiedAt: Date | null; twoFactorEnabled?: boolean }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      emailVerified: !!user.emailVerifiedAt,
      twoFactorEnabled: !!user.twoFactorEnabled,
    };
  }
}
