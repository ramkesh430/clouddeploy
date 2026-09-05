import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { IncidentSeverity, IncidentStatus, PublicServiceStatus } from "@clouddeploy/database";

export class CreateIncidentDto {
  @IsString() @MaxLength(180) title!: string;
  @IsEnum(IncidentSeverity) severity!: IncidentSeverity;
  @IsString() @MaxLength(20_000) description!: string;
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) serviceIds!: string[];
}

export class IncidentUpdateDto {
  @IsEnum(IncidentStatus) status!: IncidentStatus;
  @IsString() @MaxLength(20_000) message!: string;
}

export class UpdatePlatformServiceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(PublicServiceStatus) status?: PublicServiceStatus;
}
