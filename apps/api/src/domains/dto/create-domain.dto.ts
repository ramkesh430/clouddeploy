import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, Matches } from "class-validator";
import { EnvironmentTarget } from "@clouddeploy/database";

export class CreateDomainDto {
  @ApiProperty()
  @IsString()
  projectId!: string;

  @ApiProperty({ example: "myshop.com" })
  @IsString()
  @Matches(/^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})+$/, { message: "Enter a valid domain name" })
  hostname!: string;

  @ApiPropertyOptional({ enum: EnvironmentTarget, default: EnvironmentTarget.PRODUCTION })
  @IsOptional()
  @IsEnum(EnvironmentTarget)
  environment?: EnvironmentTarget;
}
