import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { EnvironmentTarget } from "@clouddeploy/database";

export class CreateDeploymentDto {
  @ApiProperty()
  @IsString()
  projectId!: string;

  @ApiPropertyOptional({ description: "Deploy a single service; omit to deploy the full stack" })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({ default: "main" })
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiPropertyOptional({ enum: EnvironmentTarget, default: EnvironmentTarget.PRODUCTION })
  @IsOptional()
  @IsEnum(EnvironmentTarget)
  environment?: EnvironmentTarget;
}
