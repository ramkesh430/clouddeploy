import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { SupportTicketCategory, SupportTicketPriority, SupportTicketStatus } from "@clouddeploy/database";

export class CreateSupportTicketDto {
  @IsString() organizationId!: string;
  @IsString() @MaxLength(160) subject!: string;
  @IsEnum(SupportTicketPriority) priority!: SupportTicketPriority;
  @IsEnum(SupportTicketCategory) category!: SupportTicketCategory;
  @IsString() @MaxLength(20_000) message!: string;
}

export class AddSupportMessageDto {
  @IsString() @MaxLength(20_000) message!: string;
}

export class UpdateSupportTicketDto {
  @IsOptional() @IsEnum(SupportTicketStatus) status?: SupportTicketStatus;
  @IsOptional() @IsEnum(SupportTicketPriority) priority?: SupportTicketPriority;
  @IsOptional() @IsString() assignedAdminId?: string;
}
