import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import crypto from "node:crypto";
import { decryptSecretWithFallback, hashPassword, verifyPassword, verifyTotp } from "@clouddeploy/security";
import { JwtPayload, AuthTokens } from "@clouddeploy/types";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
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
    private readonly email: EmailService,
  ) {}

  private webAppUrl(): string {
    return this.config.get<string>("WEB_APP_URL") ?? "http://localhost:3000";
  }

  /** Any organization invite sitting in the "INVITED" state for this email
   * — sent before this account existed, or before this login — becomes a
   * real membership the moment the person authenticates. Nothing else in
   * the codebase ever flips INVITED to ACTIVE, so without this an invited
   * teammate could accept forever and never actually gain access. */
  private async activatePendingInvites(userId: string, email: string) {
    await this.prisma.organizationMember.updateMany({
      where: { email: email.toLowerCase(), status: "INVITED" },
      data: { userId, status: "ACTIVE", joinedAt: new Date() },
    });
  }

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

    const verifyUrl = `${this.webAppUrl()}/verify-email?token=${verificationToken.token}`;
    void this.email.send(
      user.email,
      "Verify your CloudDeploy email",
      `<p>Hi ${user.fullName},</p><p>Confirm your email address to finish setting up your CloudDeploy account.</p><p><a href="${verifyUrl}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
    );
    await this.activatePendingInvites(user.id, user.email);

    const tokens = await this.issueTokens(user.id, user.email);
    return {
      user: this.toPublicUser(user),
      tokens,
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
    await this.activatePendingInvites(user.id, user.email);

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

  /** Issues a short-lived access token for `targetUserId` on a platform
   * admin's behalf — no refresh token or session row, since this isn't a
   * real login. Deliberately refuses to impersonate another admin (limits
   * the blast radius of a compromised admin account) or a suspended
   * account, and always leaves an audit trail. */
  async impersonate(adminId: string, targetUserId: string) {
    if (adminId === targetUserId) throw new BadRequestException("You are already signed in as this account");
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target || target.deletedAt) throw new NotFoundException("User not found");
    if (target.isPlatformAdmin) throw new ForbiddenException("Cannot impersonate another platform administrator");
    if (target.isSuspended) throw new ForbiddenException("Cannot impersonate a suspended account");

    const accessToken = await this.jwt.signAsync(
      { sub: target.id, email: target.email, type: "access" } satisfies JwtPayload,
      { secret: this.config.getOrThrow<string>("JWT_SECRET"), expiresIn: "10m" },
    );
    await this.prisma.auditLog.create({
      data: { userId: adminId, action: "user.impersonate", resourceType: "User", resourceId: target.id, newValue: { targetEmail: target.email } },
    });
    return { user: this.toPublicUser(target), accessToken, expiresIn: 600 };
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
    return { ...this.toPublicUser(user), organizations: user.organizationMembers.map((membership) => ({ ...membership.organization, role: membership.role })) };
  }

  /** A genuine, if modest, self-service export — profile, organization
   * memberships, projects, recent deployments, and support tickets. Not
   * every table in the schema, but enough that "export my data" isn't a
   * placeholder. */
  async exportOwnData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, fullName: true, avatarUrl: true, emailVerifiedAt: true, createdAt: true,
        organizationMembers: {
          where: { status: "ACTIVE" },
          select: {
            role: true,
            joinedAt: true,
            organization: {
              select: {
                id: true, name: true, slug: true, createdAt: true,
                projects: { where: { deletedAt: null }, select: { id: true, name: true, slug: true, status: true, region: true, createdAt: true } },
              },
            },
          },
        },
        supportTickets: { select: { id: true, subject: true, status: true, category: true, createdAt: true } },
        apiKeys: { where: { revokedAt: null }, select: { id: true, name: true, createdAt: true, lastUsedAt: true } },
      },
    });
    if (!user) throw new NotFoundException("Account not found");
    const { organizationMembers, ...profile } = user;
    return {
      exportedAt: new Date().toISOString(),
      profile,
      organizations: organizationMembers.map((m) => ({ role: m.role, joinedAt: m.joinedAt, ...m.organization })),
    };
  }

  /** Self-service account deletion. Refuses if the caller owns an
   * organization other people still depend on — deleting the account
   * would silently strand their teammates' access — but a solo workspace
   * (no other active members) is soft-deleted right along with the
   * account, since nobody else could reach it anyway. */
  async deleteOwnAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException("Incorrect password");
    }

    const ownedOrgs = await this.prisma.organizationMember.findMany({
      where: { userId, role: "OWNER", status: "ACTIVE" },
      include: { organization: { include: { _count: { select: { members: { where: { status: "ACTIVE" } } } } } } },
    });
    const blocking = ownedOrgs.filter((m) => m.organization._count.members > 1);
    if (blocking.length > 0) {
      throw new BadRequestException(
        `Transfer ownership of ${blocking.map((m) => m.organization.name).join(", ")} to another member before deleting your account.`,
      );
    }

    const soloOrgIds = ownedOrgs.map((m) => m.organizationId);
    await this.prisma.$transaction([
      ...(soloOrgIds.length ? [this.prisma.organization.updateMany({ where: { id: { in: soloOrgIds } }, data: { deletedAt: new Date() } })] : []),
      this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date(), email: `deleted-${userId}@clouddeploy.invalid` } }),
    ]);
    return { deleted: true };
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
    const resetUrl = `${this.webAppUrl()}/reset-password?token=${token.token}`;
    void this.email.send(
      user.email,
      "Reset your CloudDeploy password",
      `<p>Hi ${user.fullName},</p><p>Someone requested a password reset for this account. If this was you, choose a new password:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
    );
    return { sent: true };
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
        if (verifyTotp(decryptSecretWithFallback(secretCipher, this.config.getOrThrow<string>("ENCRYPTION_KEY"), this.config.get<string>("ENCRYPTION_KEY_PREVIOUS")), code)) return true;
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

  private toPublicUser(user: { id: string; email: string; fullName: string; avatarUrl: string | null; emailVerifiedAt: Date | null; twoFactorEnabled?: boolean; isPlatformAdmin?: boolean }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      emailVerified: !!user.emailVerifiedAt,
      twoFactorEnabled: !!user.twoFactorEnabled,
      isPlatformAdmin: !!user.isPlatformAdmin,
    };
  }
}
