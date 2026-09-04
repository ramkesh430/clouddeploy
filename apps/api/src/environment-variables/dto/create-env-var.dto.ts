import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsString, Matches } from "class-validator";
import { EnvironmentTarget } from "@clouddeploy/database";

export class CreateEnvVarDto {
  @ApiProperty()
  @IsString()
  projectId!: string;

  @ApiPropertyOptional({ description: "Omit to apply across all services in the project" })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({ enum: EnvironmentTarget, default: EnvironmentTarget.PRODUCTION })
  @IsOptional()
  @IsEnum(EnvironmentTarget)
  environment?: EnvironmentTarget;

  @ApiProperty({ example: "DATABASE_URL" })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/, { message: "Key must be SCREAMING_SNAKE_CASE" })
  key!: string;

  @ApiProperty({ example: "postgres://user:pass@host:5432/db" })
  @IsString()
  value!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;
}
