import { SetMetadata } from "@nestjs/common";
import { OrgRole } from "@clouddeploy/database";

export const ROLES_KEY = "roles";

/** Restricts a route to organization members holding one of the given roles. */
export const Roles = (...roles: OrgRole[]) => SetMetadata(ROLES_KEY, roles);
