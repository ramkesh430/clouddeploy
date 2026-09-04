import { BadRequestException, Body, Controller, Get, Headers, Post, Query, RawBodyRequest, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { BillingService } from "./billing.service";
import { OrgRole } from "@clouddeploy/database";

@ApiTags("billing")
@Controller({ path: "billing", version: "1" })
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: "Get billing summary: subscription, plan, invoices, payment methods" })
  summary(@Query("organizationId") organizationId: string) {
    return this.billingService.getSummary(organizationId);
  }

  @Post("checkout")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrgRole.OWNER, OrgRole.BILLING_MANAGER)
  @ApiOperation({ summary: "Create a Stripe Checkout session to subscribe or change plans" })
  checkout(
    @Query("organizationId") organizationId: string,
    @Body("planTier") planTier: string,
    @Body("billingPeriod") billingPeriod: "monthly" | "yearly" = "monthly",
  ) {
    return this.billingService.createCheckoutSession(organizationId, planTier, billingPeriod);
  }

  @Post("portal")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrgRole.OWNER, OrgRole.BILLING_MANAGER)
  @ApiOperation({ summary: "Create a Stripe customer portal session (manage payment methods, cancel, etc.)" })
  portal(@Query("organizationId") organizationId: string) {
    return this.billingService.createPortalSession(organizationId);
  }

  @Post("cancel")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrgRole.OWNER, OrgRole.BILLING_MANAGER)
  @ApiOperation({ summary: "Cancel the subscription at period end" })
  cancel(@Query("organizationId") organizationId: string) {
    return this.billingService.cancelSubscription(organizationId);
  }

  @Post("webhook")
  @ApiOperation({ summary: "Stripe webhook receiver (signature-verified, no auth guard)" })
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers("stripe-signature") signature: string) {
    if (!req.rawBody) throw new BadRequestException("Missing raw request body");
    return this.billingService.handleWebhook(req.rawBody, signature);
  }
}
