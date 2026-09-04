import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface ActivityLogEntry {
  organizationId: string;
  projectId?: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  status?: "success" | "failure";
}

/** Thin, shared writer for the ActivityLog audit trail so every call site
 * (invites, role changes, API keys, webhooks, rollbacks, backup restores,
 * subscription changes, storage deletions, ...) produces rows in the same
 * shape instead of each service hand-rolling its own `prisma.activityLog.create`. */
@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: ActivityLogEntry) {
    await this.prisma.activityLog.create({
      data: {
        organizationId: entry.organizationId,
        projectId: entry.projectId,
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        status: entry.status ?? "success",
      },
    });
  }

  async list(organizationId: string, take = 100) {
    return this.prisma.activityLog.findMany({
      where: { organizationId },
      include: { user: { select: { fullName: true, email: true } }, project: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
}
