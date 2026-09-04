import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ImportRepositoryDto {
  @ApiProperty()
  @IsString()
  projectId!: string;

  @ApiProperty()
  @IsString()
  connectionId!: string;

  @ApiProperty({ example: "octocat/hello-world" })
  @IsString()
  fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branch?: string;
}
