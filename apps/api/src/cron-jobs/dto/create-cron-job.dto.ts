import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { EnvironmentTarget } from "@clouddeploy/database";

export class CreateCronJobDto {
  @ApiProperty()
  @IsString()
  projectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiProperty({ example: "Daily Backup" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "npm run backup" })
  @IsString()
  command!: string;

  @ApiProperty({ example: "0 2 * * *" })
  @IsString()
  cronExpression!: string;

  @ApiPropertyOptional({ default: "UTC" })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ enum: EnvironmentTarget, default: EnvironmentTarget.PRODUCTION })
  @IsOptional()
  @IsEnum(EnvironmentTarget)
  environment?: EnvironmentTarget;
}
