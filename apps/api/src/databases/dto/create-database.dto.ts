import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsIn, IsOptional, IsString, Matches } from "class-validator";
import { DatabaseEngine } from "@clouddeploy/database";

export class CreateDatabaseDto {
  @ApiProperty()
  @IsString()
  organizationId!: string;

  @ApiProperty({ example: "shopfront-db" })
  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/)
  name!: string;

  @ApiProperty({ enum: DatabaseEngine })
  @IsEnum(DatabaseEngine)
  engine!: DatabaseEngine;

  @ApiPropertyOptional({ example: "16" })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ example: "us-east" })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ enum: ["nano", "starter", "developer", "pro"], default: "starter" })
  @IsOptional()
  @IsIn(["nano", "starter", "developer", "pro"])
  resourcePreset?: "nano" | "starter" | "developer" | "pro";

  @ApiPropertyOptional({ default: "daily" })
  @IsOptional()
  @IsIn(["manual", "daily", "weekly"])
  backupFrequency?: string;
}
