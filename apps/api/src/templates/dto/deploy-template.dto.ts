import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class DeployTemplateDto {
  @ApiProperty()
  @IsString()
  organizationId!: string;

  @ApiProperty({ example: "my-n8n" })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  projectName!: string;

  @ApiPropertyOptional({ example: "my-n8n", description: "Defaults to a slugified projectName" })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "Slug must be lowercase letters, numbers, and hyphens only" })
  projectSlug?: string;

  @ApiPropertyOptional({ example: "us-east", description: "Deployment region; stateful dependencies are colocated" })
  @IsOptional()
  @IsString()
  region?: string;
}
