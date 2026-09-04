import { Injectable } from "@nestjs/common";
import { NotificationType, NotificationChannel } from "@clouddeploy/database";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(notificationId: string) {
    await this.prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
    return { read: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { read: true };
  }

  /** Creates an in-app notification for one user, respecting their
   * per-type IN_APP preference (defaults to enabled if no row exists), and
   * separately emails them if their per-type EMAIL preference allows it
   * (same opt-out default) — the two channels are independent, so a user
   * can mute in-app noise for a type while still getting it by email. */
  async notify(organizationId: string, userId: string, type: NotificationType, title: string, message: string) {
    const [inAppPref, emailPref] = await Promise.all([
      this.prisma.notificationPreference.findUnique({
        where: { userId_type_channel: { userId, type, channel: "IN_APP" } } as never,
      }),
      this.prisma.notificationPreference.findUnique({
        where: { userId_type_channel: { userId, type, channel: "EMAIL" } } as never,
      }),
    ]);

    if (!emailPref || emailPref.enabled) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (user) {
        void this.email.send(user.email, title, `<p>${message}</p>`);
      }
    }

    if (inAppPref && !inAppPref.enabled) return null;
    return this.prisma.notification.create({ data: { organizationId, userId, type, title, message } });
  }

  /** Notifies every active member of an organization (used for org-wide
   * events like a failed backup, where there's no single "owning" user). */
  async notifyOrganization(organizationId: string, type: NotificationType, title: string, message: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId, status: "ACTIVE", userId: { not: null } },
      select: { userId: true },
    });
    await Promise.all(
      members.map((m) => this.notify(organizationId, m.userId!, type, title, message).catch(() => undefined)),
    );
  }

  async listPreferences(userId: string) {
    return this.prisma.notificationPreference.findMany({ where: { userId } });
  }

  async setPreference(userId: string, type: NotificationType, channel: NotificationChannel, enabled: boolean) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_type_channel: { userId, type, channel } } as never,
      create: { userId, type, channel, enabled },
      update: { enabled },
    });
  }
}
