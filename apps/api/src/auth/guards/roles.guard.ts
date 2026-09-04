import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OrgRole } from "@clouddeploy/database";
import { PrismaService } from "../../prisma/prisma.service";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";

/**
 * Enforces RBAC + tenant isolation: resolves the organization the request
 * targets (route param, body, or the project it references), loads the
 * caller's membership row for that organization, and rejects the request if
 * the caller isn't a member or doesn't hold one of the required roles.
 * This is the single place that stands between a request and cross-tenant
 * data access — every mutating route on a tenant resource must go through it.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;
    if (user.isPlatformAdmin) return true;

    const organizationId = await this.resolveOrganizationId(request);
    if (!organizationId) {
      throw new ForbiddenException("Unable to resolve organization for this request");
    }

    const membership = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId: user.id, status: "ACTIVE" },
    });

    if (!membership) {
      throw new ForbiddenException("You are not a member of this organization");
    }

    request.organizationId = organizationId;
    request.organizationRole = membership.role;

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(`Requires one of roles: ${requiredRoles.join(", ")}`);
    }
    return true;
  }

  private async resolveOrganizationId(request: any): Promise<string | undefined> {
    if (request.params?.organizationId) return request.params.organizationId;
    if (request.headers?.["x-organization-id"]) return request.headers["x-organization-id"];
    if (request.query?.organizationId) return request.query.organizationId;
    if (request.body?.organizationId) return request.body.organizationId;

    const projectId = request.params?.projectId ?? request.body?.projectId ?? request.query?.projectId;
    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
      });
      return project?.organizationId;
    }

    const serviceId = request.params?.serviceId;
    if (serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: serviceId },
        select: { project: { select: { organizationId: true } } },
      });
      return service?.project.organizationId;
    }

    const deploymentId = request.params?.deploymentId;
    if (deploymentId) {
      const deployment = await this.prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { project: { select: { organizationId: true } } },
      });
      return deployment?.project.organizationId;
    }

    const databaseId = request.params?.databaseId;
    if (databaseId) {
      const database = await this.prisma.database.findUnique({
        where: { id: databaseId },
        select: { organizationId: true },
      });
      return database?.organizationId;
    }

    const domainId = request.params?.domainId;
    if (domainId) {
      const domain = await this.prisma.domain.findUnique({
        where: { id: domainId },
        select: { organizationId: true },
      });
      return domain?.organizationId;
    }

    const envVarId = request.params?.envVarId;
    if (envVarId) {
      const envVar = await this.prisma.environmentVariable.findUnique({
        where: { id: envVarId },
        select: { project: { select: { organizationId: true } } },
      });
      return envVar?.project.organizationId;
    }

    const redisInstanceId = request.params?.redisInstanceId;
    if (redisInstanceId) {
      const instance = await this.prisma.redisInstance.findUnique({
        where: { id: redisInstanceId },
        select: { service: { select: { project: { select: { organizationId: true } } } } },
      });
      return instance?.service.project.organizationId;
    }

    const bucketId = request.params?.bucketId;
    if (bucketId) {
      const bucket = await this.prisma.storageBucket.findUnique({
        where: { id: bucketId },
        select: { organizationId: true },
      });
      return bucket?.organizationId;
    }

    const cronJobId = request.params?.cronJobId;
    if (cronJobId) {
      const cronJob = await this.prisma.cronJob.findUnique({
        where: { id: cronJobId },
        select: { project: { select: { organizationId: true } } },
      });
      return cronJob?.project.organizationId;
    }
    return undefined;
  }
}
