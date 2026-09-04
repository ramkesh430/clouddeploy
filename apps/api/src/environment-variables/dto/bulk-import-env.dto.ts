import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { EnvironmentTarget } from "@clouddeploy/database";

export class BulkImportEnvDto {
  @ApiProperty()
  @IsString()
  projectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({ enum: EnvironmentTarget, default: EnvironmentTarget.PRODUCTION })
  @IsOptional()
  @IsEnum(EnvironmentTarget)
  environment?: EnvironmentTarget;

  @ApiProperty({ example: "NODE_ENV=production\nDATABASE_URL=postgres://...\nJWT_SECRET=..." })
  @IsString()
  raw!: string;
}
