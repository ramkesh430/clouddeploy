import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class RepositoryFileDto {
  @IsString()
  @MaxLength(500)
  path!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  content?: string;
}

export class AnalyzeRepositoryDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsString()
  repositoryFullName!: string;

  @IsOptional()
  @IsString()
  defaultBranch?: string;

  @IsArray()
  @ArrayMaxSize(2_000)
  @ValidateNested({ each: true })
  @Type(() => RepositoryFileDto)
  files!: RepositoryFileDto[];
}

export class AnalyzeLogsDto {
  @IsString()
  organizationId!: string;

  @IsString()
  deploymentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  logs?: string;
}

export class GenerateDockerfileDto extends AnalyzeRepositoryDto {
  @IsOptional()
  @IsString()
  serviceName?: string;
}

export class RecommendResourcesDto {
  @IsString()
  organizationId!: string;

  @IsString()
  projectId!: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  trafficRequestsPerMinute?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  databaseSizeMb?: number;

  @IsOptional()
  @IsBoolean()
  latencySensitive?: boolean;
}

export class ApplyFixDto {
  @IsOptional()
  @IsObject()
  overrides?: Record<string, unknown>;
}

export class RejectFixDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
