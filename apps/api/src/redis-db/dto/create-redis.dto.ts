import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches } from "class-validator";

export class CreateRedisDto {
  @ApiProperty()
  @IsString()
  projectId!: string;

  @ApiProperty({ example: "cache" })
  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/)
  name!: string;

  @ApiPropertyOptional({ enum: ["nano", "starter", "developer", "pro"], default: "nano" })
  @IsOptional()
  @IsIn(["nano", "starter", "developer", "pro"])
  resourcePreset?: "nano" | "starter" | "developer" | "pro";

  @ApiPropertyOptional({ default: "allkeys-lru" })
  @IsOptional()
  @IsString()
  maxMemoryPolicy?: string;

  @ApiPropertyOptional({ description: "Service to automatically inject REDIS_URL into once provisioned" })
  @IsOptional()
  @IsString()
  attachToServiceId?: string;
}
