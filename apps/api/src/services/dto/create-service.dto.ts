import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Framework, Runtime, ServiceType } from "@clouddeploy/database";

export class CreateServiceDto {
  @ApiProperty()
  @IsString()
  projectId!: string;

  @ApiProperty({ example: "backend" })
  @IsString()
  name!: string;

  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType)
  type!: ServiceType;

  @ApiPropertyOptional({ enum: Runtime, default: Runtime.NODE })
  @IsOptional()
  @IsEnum(Runtime)
  runtime?: Runtime;

  @ApiPropertyOptional({ enum: Framework, default: Framework.UNKNOWN })
  @IsOptional()
  @IsEnum(Framework)
  framework?: Framework;

  @ApiPropertyOptional({ default: "." })
  @IsOptional()
  @IsString()
  rootDirectory?: string;

  @ApiPropertyOptional({ default: "main" })
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buildCommand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startCommand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ default: "/" })
  @IsOptional()
  @IsString()
  healthCheckPath?: string;

  @ApiPropertyOptional({ enum: ["nano", "starter", "developer", "pro"], default: "starter" })
  @IsOptional()
  @IsIn(["nano", "starter", "developer", "pro"])
  resourcePreset?: "nano" | "starter" | "developer" | "pro";
}
