import { IsBoolean, IsEmail, IsEnum, IsHexColor, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from "class-validator";
import { AgencyClientStatus } from "@clouddeploy/database";

export class CreateAgencyClientDto {
  @IsString()
  organizationId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  company?: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  notes?: string;

  @IsOptional()
  @IsString()
  billingReference?: string;
}

export class UpdateAgencyClientDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(160) company?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(5_000) notes?: string;
  @IsOptional() @IsString() billingReference?: string;
  @IsOptional() @IsEnum(AgencyClientStatus) status?: AgencyClientStatus;
}

export class AssignClientProjectDto {
  @IsString()
  projectId!: string;

  @IsOptional() @IsInt() @Min(0) monthlyCostCents?: number;
  @IsOptional() @IsInt() @Min(0) monthlyRevenueCents?: number;
}

export class UpdateBrandingDto {
  @IsString()
  organizationId!: string;

  @IsString()
  @MaxLength(100)
  brandName!: string;

  @IsOptional() @IsUrl({ require_tld: false }) logoUrl?: string;
  @IsOptional() @IsString() customDomain?: string;
  @IsOptional() @IsHexColor() primaryAccent?: string;
  @IsOptional() @IsEmail() supportEmail?: string;
  @IsOptional() @IsString() @MaxLength(120) loginTitle?: string;
  @IsOptional() @IsString() @MaxLength(240) loginSubtitle?: string;
  @IsOptional() @IsBoolean() customLoginEnabled?: boolean;
}

export class UpdatePortalAccessDto {
  @IsOptional() @IsBoolean() metricsReadOnly?: boolean;
  @IsOptional() @IsBoolean() invoicesVisible?: boolean;
  @IsOptional() @IsBoolean() deploymentStatus?: boolean;
  @IsOptional() @IsBoolean() domainStatus?: boolean;
  @IsOptional() @IsBoolean() supportAccess?: boolean;
}

export class AgencyListQueryDto {
  @IsString()
  organizationId!: string;

  @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() cursor?: string;
}
