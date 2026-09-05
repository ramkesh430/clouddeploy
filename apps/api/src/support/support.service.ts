import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AddSupportMessageDto, CreateSupportTicketDto, UpdateSupportTicketDto } from "./dto/support.dto";

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSupportTicketDto, userId: string) {
    const { message, ...ticket } = dto;
    return this.prisma.supportTicket.create({
      data: { ...ticket, userId, messages: { create: { authorId: userId, body: message } } },
      include: { messages: true },
    });
  }

  list(organizationId: string, userId: string, all = false) {
    return this.prisma.supportTicket.findMany({
      where: all ? {} : { organizationId, userId },
      include: { user: { select: { id: true, fullName: true, email: true } }, assignedAdmin: { select: { id: true, fullName: true } }, _count: { select: { messages: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  async detail(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId }, include: { user: { select: { id: true, fullName: true, email: true } }, assignedAdmin: { select: { id: true, fullName: true, email: true } }, messages: { include: { author: { select: { id: true, fullName: true } } }, orderBy: { createdAt: "asc" } } } });
    if (!ticket) throw new NotFoundException("Support ticket not found");
    return ticket;
  }

  async addMessage(ticketId: string, dto: AddSupportMessageDto, userId: string, isAdmin = false) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException("Support ticket not found");
    const status = isAdmin ? "WAITING_USER" : "WAITING_SUPPORT";
    const [message] = await this.prisma.$transaction([
      this.prisma.supportMessage.create({ data: { ticketId, authorId: userId, body: dto.message, isAdmin } }),
      this.prisma.supportTicket.update({ where: { id: ticketId }, data: { status } }),
    ]);
    return message;
  }

  async update(ticketId: string, dto: UpdateSupportTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException("Support ticket not found");
    return this.prisma.supportTicket.update({ where: { id: ticketId }, data: dto });
  }
}
