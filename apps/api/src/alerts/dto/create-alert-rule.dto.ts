import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { AlertMetric, AlertComparator } from "@clouddeploy/database";

export class CreateAlertRuleDto {
  @ApiProperty()
  @IsString()
  organizationId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: "Required for CPU_PCT / RAM_PCT rules" })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({ description: "Required for DATABASE_CONNECTIONS / DATABASE_STORAGE_PCT rules" })
  @IsOptional()
  @IsString()
  databaseId?: string;

  @ApiProperty({ enum: AlertMetric })
  @IsEnum(AlertMetric)
  metric!: AlertMetric;

  @ApiPropertyOptional({ enum: AlertComparator, default: AlertComparator.GREATER_THAN })
  @IsOptional()
  @IsEnum(AlertComparator)
  comparator?: AlertComparator;

  @ApiProperty({ example: 80 })
  @IsNumber()
  threshold!: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  cooldownMinutes?: number;
}
