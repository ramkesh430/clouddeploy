import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export const API_KEY_PERMISSIONS = [
  "projects:read",
  "projects:write",
  "deployments:read",
  "deployments:write",
  "logs:read",
  "databases:read",
  "databases:write",
  "domains:read",
  "domains:write",
  "environment:read",
  "environment:write",
  "services:read",
  "services:write",
  "ai:write",
  "billing:read",
] as const;

export class CreateApiKeyDto {
  @ApiProperty()
  @IsString()
  organizationId!: string;

  @ApiProperty({ example: "CI Deploy Key" })
  @IsString()
  name!: string;

  @ApiProperty({ enum: API_KEY_PERMISSIONS, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(API_KEY_PERMISSIONS, { each: true })
  permissions!: string[];

  @ApiProperty({ required: false, type: [String], description: "Optional exact IPs or IPv4 CIDR ranges" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIpRanges?: string[];

  @ApiProperty({ required: false, minimum: 1, maximum: 10_000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  rateLimitPerMinute?: number;
}
