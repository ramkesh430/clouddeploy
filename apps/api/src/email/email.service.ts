import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { Transporter } from "nodemailer";

/**
 * Sends real email over SMTP. In development this points at the local
 * Mailpit container (infra/docker/docker-compose.yml) — a real SMTP server
 * whose web UI (http://localhost:8025) lets you read what was actually
 * sent, rather than mocking the transport and trusting that the call
 * happened. In production, SMTP_HOST/PORT/USER/PASS point at a real
 * provider (e.g. Resend's or Postmark's SMTP endpoint).
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger("EmailService");
  private transporter!: Transporter;
  private from!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.from = this.config.get<string>("SMTP_FROM", "CloudDeploy <notifications@clouddeploy.local>");
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASS");
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>("SMTP_HOST", "localhost"),
      port: this.config.get<number>("SMTP_PORT", 1025),
      secure: this.config.get<boolean>("SMTP_SECURE", false),
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (err) {
      this.logger.warn(`Failed to send email to ${to}: ${(err as Error).message}`);
    }
  }
}
