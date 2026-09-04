import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, IsUrl } from "class-validator";

export const WEBHOOK_EVENTS = [
  "deployment.started",
  "deployment.success",
  "deployment.failed",
  "service.restarted",
  "database.backup.completed",
  "database.backup.failed",
  "alert.triggered",
] as const;

export class CreateWebhookDto {
  @ApiProperty()
  @IsString()
  organizationId!: string;

  @ApiPropertyOptional({ description: "Scope to a single project; omit to receive events for the whole workspace" })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty({ example: "https://example.com/webhooks/clouddeploy" })
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiProperty({ enum: WEBHOOK_EVENTS, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: string[];
}
