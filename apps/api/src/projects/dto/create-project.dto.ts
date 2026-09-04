import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateProjectDto {
  @ApiProperty({ example: "clx1234organizationid", description: "Workspace this project belongs to" })
  @IsString()
  organizationId!: string;

  @ApiProperty({ example: "ShopFront" })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @ApiProperty({ example: "shopfront" })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "Slug must be lowercase letters, numbers, and hyphens only" })
  slug!: string;

  @ApiPropertyOptional({ example: "Full-stack e-commerce storefront" })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @ApiPropertyOptional({ example: "us-east" })
  @IsOptional()
  @IsString()
  region?: string;
}
