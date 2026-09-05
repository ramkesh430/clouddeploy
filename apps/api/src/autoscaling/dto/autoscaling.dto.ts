import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class UpsertAutoscalingPolicyDto {
  @IsString() projectId!: string;
  @IsString() serviceId!: string;
  @IsBoolean() enabled!: boolean;
  @IsInt() @Min(1) @Max(100) minimumInstances!: number;
  @IsInt() @Min(1) @Max(100) maximumInstances!: number;
  @IsNumber() @Min(1) @Max(100) cpuThresholdPct!: number;
  @IsNumber() @Min(1) @Max(100) memoryThresholdPct!: number;
  @IsOptional() @IsInt() @Min(1) requestThreshold?: number;
  @IsInt() @Min(30) scaleUpCooldownSeconds!: number;
  @IsInt() @Min(30) scaleDownCooldownSeconds!: number;
}
