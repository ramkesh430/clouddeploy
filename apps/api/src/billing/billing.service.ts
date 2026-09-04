import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BillingService {
  private readonly logger = new Logger("BillingService");
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private isConfigured(): boolean {
    return Boolean(this.config.get<string>("STRIPE_SECRET_KEY"));
  }

  private getStripe(): Stripe {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "Billing is not configured in this environment — set STRIPE_SECRET_KEY to enable checkout.",
      );
    }
    if (!this.stripe) {
      this.stripe = new Stripe(this.config.getOrThrow("STRIPE_SECRET_KEY"), { apiVersion: "2024-06-20" });
    }
    return this.stripe;
  }

  async getSummary(organizationId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const paymentMethods = await this.prisma.paymentMethod.findMany({ where: { organizationId } });

    return {
      billingConfigured: this.isConfigured(),
      subscription,
      invoices,
      paymentMethods,
    };
  }

  async createCheckoutSession(organizationId: string, planTier: string, billingPeriod: "monthly" | "yearly") {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException("Organization not found");

    const plan = await this.prisma.plan.findUnique({ where: { tier: planTier as never } });
    if (!plan) throw new NotFoundException("Plan not found");

    const priceId = billingPeriod === "yearly" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;
    if (!priceId) {
      throw new BadRequestException(
        `No Stripe price configured for ${plan.name} (${billingPeriod}). Set it via the Stripe dashboard and store the price ID on the Plan record.`,
      );
    }

    const stripe = this.getStripe();
    let subscription = await this.prisma.subscription.findUnique({ where: { organizationId } });

    let customerId = subscription?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ name: org.name, metadata: { organizationId } });
      customerId = customer.id;
    }

    const webAppUrl = this.config.get<string>("WEB_APP_URL") ?? "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${webAppUrl}/billing?checkout=success`,
      cancel_url: `${webAppUrl}/billing?checkout=cancelled`,
      metadata: { organizationId, planTier },
    });

    if (!subscription) {
      subscription = await this.prisma.subscription.create({
        data: { organizationId, planId: plan.id, status: "INCOMPLETE", stripeCustomerId: customerId },
      });
    } else {
      await this.prisma.subscription.update({ where: { organizationId }, data: { stripeCustomerId: customerId } });
    }

    return { checkoutUrl: session.url };
  }

  async createPortalSession(organizationId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { organizationId } });
    if (!subscription?.stripeCustomerId) {
      throw new BadRequestException("This workspace has no billing account yet — start a checkout first.");
    }
    const stripe = this.getStripe();
    const webAppUrl = this.config.get<string>("WEB_APP_URL") ?? "http://localhost:3000";
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${webAppUrl}/billing`,
    });
    return { portalUrl: session.url };
  }

  async cancelSubscription(organizationId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { organizationId } });
    if (!subscription?.stripeSubscriptionId) {
      throw new BadRequestException("No active Stripe subscription to cancel");
    }
    const stripe = this.getStripe();
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, { cancel_at_period_end: true });
    return this.prisma.subscription.update({ where: { organizationId }, data: { cancelAtPeriodEnd: true } });
  }

  /** Verifies the Stripe signature and applies the event to our records. */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ received: true }> {
    const webhookSecret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new ServiceUnavailableException("STRIPE_WEBHOOK_SECRET is not configured");
    }
    const stripe = this.getStripe();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.metadata?.organizationId;
        if (organizationId && session.subscription) {
          await this.prisma.subscription.update({
            where: { organizationId },
            data: { stripeSubscriptionId: session.subscription as string, status: "ACTIVE" },
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const existing = await this.prisma.subscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (existing) {
          await this.prisma.subscription.update({
            where: { id: existing.id },
            data: {
              status: this.mapStripeStatus(sub.status),
              currentPeriodStart: new Date(sub.current_period_start * 1000),
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            },
          });
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const organizationId = invoice.subscription_details?.metadata?.organizationId;
        if (organizationId) {
          await this.prisma.invoice.upsert({
            where: { id: invoice.id },
            create: {
              id: invoice.id,
              organizationId,
              stripeInvoiceId: invoice.id,
              status: invoice.status === "paid" ? "PAID" : "OPEN",
              amountDueCents: invoice.amount_due,
              amountPaidCents: invoice.amount_paid,
              currency: invoice.currency,
              pdfUrl: invoice.invoice_pdf ?? undefined,
              issuedAt: new Date(invoice.created * 1000),
              paidAt: invoice.status === "paid" ? new Date() : undefined,
            },
            update: {
              status: invoice.status === "paid" ? "PAID" : "OPEN",
              amountPaidCents: invoice.amount_paid,
              paidAt: invoice.status === "paid" ? new Date() : undefined,
            },
          });
        }
        break;
      }
      default:
        this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }

    return { received: true };
  }

  private mapStripeStatus(status: Stripe.Subscription.Status): "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" {
    switch (status) {
      case "trialing":
        return "TRIALING";
      case "active":
        return "ACTIVE";
      case "past_due":
        return "PAST_DUE";
      case "canceled":
      case "unpaid":
        return "CANCELED";
      default:
        return "INCOMPLETE";
    }
  }
}
