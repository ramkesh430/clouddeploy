import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";
import { ContainerStatus, NodeRole, ServerCommandStatus, ServerCommandType } from "@clouddeploy/database";

export class CreateRegionDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsString() continent!: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() city?: string;
}

export class RegisterServerDto {
  @IsString() hostname!: string;
  @IsString() ipAddress!: string;
  @IsString() region!: string;
  @IsEnum(NodeRole) role!: NodeRole;
  @IsNumber() @Min(0.1) cpuCores!: number;
  @IsInt() @Min(128) ramMb!: number;
  @IsInt() @Min(1024) diskMb!: number;
}

export class ContainerHeartbeatDto {
  @IsString() containerId!: string;
  @IsEnum(ContainerStatus) status!: ContainerStatus;
  @IsBoolean() healthy!: boolean;
  @IsOptional() @IsString() privateIp?: string;
}

export class ServerHeartbeatDto {
  @IsString() agentVersion!: string;
  @IsNumber() @Min(0) @Max(100) cpuPct!: number;
  @IsNumber() @Min(0) @Max(100) ramPct!: number;
  @IsNumber() @Min(0) @Max(100) diskPct!: number;
  @IsOptional() @IsInt() @Min(0) containerCount?: number;
  @IsOptional() @IsInt() @Min(0) currentBuilds?: number;
  @IsOptional() @IsInt() @Min(0) queueDepth?: number;
  @IsOptional() @IsInt() @Min(0) databaseCount?: number;
  @IsOptional() @IsInt() @Min(0) activeConnections?: number;
  @IsOptional() @IsBoolean() backupHealthy?: boolean;
  @IsOptional() @IsInt() @Min(0) objectCount?: number;
  @IsOptional() @IsBoolean() replicationHealthy?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(2_000) @ValidateNested({ each: true }) @Type(() => ContainerHeartbeatDto) containers?: ContainerHeartbeatDto[];
}

export class ServerActionDto {
  @IsEnum(ServerCommandType) action!: ServerCommandType;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}

export class CompleteServerCommandDto {
  @IsEnum(ServerCommandStatus) status!: ServerCommandStatus;
  @IsOptional() @IsObject() result?: Record<string, unknown>;
}
