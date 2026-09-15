import { DomainType, EnvironmentTarget, DomainStatus, PlanTier, ProjectStatus, SubscriptionStatus } from "@clouddeploy/database";
import { IsBoolean, IsEmail, IsEnum, IsInt, IsObject, IsOptional, IsString, Matches, Min, MinLength } from "class-validator";

export class CreateAdminUserDto {
  @IsString() @MinLength(1) fullName!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsBoolean() isPlatformAdmin?: boolean;
}

export class UpdateAdminUserDto {
  @IsOptional() @IsString() @MinLength(1) fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsBoolean() isPlatformAdmin?: boolean;
}

export class CreateOrganizationDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() @Matches(/^[a-z0-9-]+$/, { message: "slug may only contain lowercase letters, numbers, and hyphens" }) slug!: string;
  @IsOptional() @IsBoolean() isAgency?: boolean;
}

export class UpdateOrganizationDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9-]+$/, { message: "slug may only contain lowercase letters, numbers, and hyphens" }) slug?: string;
  @IsOptional() @IsBoolean() isAgency?: boolean;
}

export class CreateAdminProjectDto {
  @IsString() organizationId!: string;
  @IsString() @MinLength(1) name!: string;
  @IsString() @Matches(/^[a-z0-9-]+$/, { message: "slug may only contain lowercase letters, numbers, and hyphens" }) slug!: string;
  @IsOptional() @IsString() region?: string;
}

export class UpdateAdminProjectDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @IsOptional() @IsString() region?: string;
}

export class CreatePlanDto {
  @IsEnum(PlanTier) tier!: PlanTier;
  @IsString() @MinLength(1) name!: string;
  @IsInt() @Min(0) priceMonthlyCents!: number;
  @IsInt() @Min(0) priceYearlyCents!: number;
  @IsInt() @Min(1) maxProjects!: number;
  @IsInt() @Min(1) maxRamMb!: number;
  @IsOptional() @IsObject() features?: Record<string, unknown>;
}

export class UpdatePlanDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsInt() @Min(0) priceMonthlyCents?: number;
  @IsOptional() @IsInt() @Min(0) priceYearlyCents?: number;
  @IsOptional() @IsInt() @Min(1) maxProjects?: number;
  @IsOptional() @IsInt() @Min(1) maxRamMb?: number;
  @IsOptional() @IsObject() features?: Record<string, unknown>;
}

export class CreateAdminDomainDto {
  @IsString() organizationId!: string;
  @IsString() projectId!: string;
  @IsString() @MinLength(3) hostname!: string;
  @IsOptional() @IsEnum(DomainType) type?: DomainType;
  @IsOptional() @IsEnum(EnvironmentTarget) environment?: EnvironmentTarget;
}

export class UpdateAdminDomainDto {
  @IsOptional() @IsEnum(DomainStatus) status?: DomainStatus;
  @IsOptional() @IsEnum(EnvironmentTarget) environment?: EnvironmentTarget;
}

export class UpdateSubscriptionDto {
  @IsOptional() @IsString() planId?: string;
  @IsOptional() @IsEnum(SubscriptionStatus) status?: SubscriptionStatus;
}

export class ActivateSubscriptionDto {
  @IsString() organizationId!: string;
  @IsString() planId!: string;
  @IsOptional() @IsString() billingPeriod?: string;
  @IsOptional() @IsEnum(SubscriptionStatus) status?: SubscriptionStatus;
}

export class UpdatePlatformSettingsDto {
  @IsOptional() @IsString() @MinLength(1) platformName?: string;
  @IsOptional() @IsEmail() supportEmail?: string;
  @IsOptional() @IsString() defaultRegion?: string;
  @IsOptional() @IsBoolean() maintenanceMode?: boolean;
  @IsOptional() @IsString() maintenanceMessage?: string;
}
