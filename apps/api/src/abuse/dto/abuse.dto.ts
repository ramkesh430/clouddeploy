import { ArrayMaxSize, IsArray, IsEnum, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { AbuseReportType, RiskEventType, RiskSeverity } from "@clouddeploy/database";

export class CreateAbuseReportDto {
  @IsString() organizationId!: string;
  @IsOptional() @IsString() projectId?: string;
  @IsEnum(AbuseReportType) type!: AbuseReportType;
  @IsString() @MaxLength(20_000) details!: string;
}

export class CreateRiskEventDto {
  @IsString() organizationId!: string;
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @IsString() serviceId?: string;
  @IsEnum(RiskEventType) type!: RiskEventType;
  @IsEnum(RiskSeverity) severity!: RiskSeverity;
  @IsString() @MaxLength(200) title!: string;
  @IsObject() evidence!: Record<string, unknown>;
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) recommendedActions!: string[];
}

export enum AbuseAction {
  TERMINATE_CONTAINERS = "TERMINATE_CONTAINERS",
  SUSPEND_PROJECT = "SUSPEND_PROJECT",
  SUSPEND_USER = "SUSPEND_USER",
  MANUAL_REVIEW = "MANUAL_REVIEW",
  DISMISS = "DISMISS",
  REINSTATE_PROJECT = "REINSTATE_PROJECT",
  REINSTATE_USER = "REINSTATE_USER",
}

export class ApplyAbuseActionDto {
  @IsEnum(AbuseAction) action!: AbuseAction;
  @IsOptional() @IsString() targetUserId?: string;
  @IsOptional() @IsString() @MaxLength(1_000) reason?: string;
}
