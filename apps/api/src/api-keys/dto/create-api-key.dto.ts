import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsIn, IsString } from "class-validator";

export const API_KEY_PERMISSIONS = [
  "projects:read",
  "projects:write",
  "deployments:read",
  "deployments:write",
  "logs:read",
  "databases:read",
  "databases:write",
  "domains:read",
  "domains:write",
  "billing:read",
] as const;

export class CreateApiKeyDto {
  @ApiProperty()
  @IsString()
  organizationId!: string;

  @ApiProperty({ example: "CI Deploy Key" })
  @IsString()
  name!: string;

  @ApiProperty({ enum: API_KEY_PERMISSIONS, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(API_KEY_PERMISSIONS, { each: true })
  permissions!: string[];
}
