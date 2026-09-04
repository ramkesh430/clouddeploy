import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, Matches } from "class-validator";

export class CreateBucketDto {
  @ApiProperty()
  @IsString()
  organizationId!: string;

  @ApiProperty({ example: "uploads" })
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{1,61}$/, { message: "Bucket name must be lowercase letters, numbers, and hyphens" })
  name!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
