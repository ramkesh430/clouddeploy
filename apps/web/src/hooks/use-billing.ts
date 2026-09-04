"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

export interface Plan {
  id: string;
  tier: string;
  name: string;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  maxProjects: number;
  maxRamMb: number;
  features: Record<string, boolean>;
}

export interface BillingSummary {
  billingConfigured: boolean;
  subscription: {
    status: string;
    billingPeriod: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    plan: Plan;
  } | null;
  invoices: Array<{ id: string; status: string; amountDueCents: number; currency: string; createdAt: string; pdfUrl: string | null }>;
  paymentMethods: Array<{ id: string; brand: string | null; last4: string | null }>;
}

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<Plan[]>("/plans", { skipAuth: true }),
  });
}

export function useBillingSummary(organizationId: string | null) {
  return useQuery({
    queryKey: ["billing", organizationId],
    queryFn: () => api.get<BillingSummary>(`/billing?organizationId=${organizationId}`),
    enabled: !!organizationId,
  });
}

export function useCheckout(organizationId: string | null) {
  return useMutation({
    mutationFn: (input: { planTier: string; billingPeriod: "monthly" | "yearly" }) =>
      api.post<{ checkoutUrl: string }>(`/billing/checkout?organizationId=${organizationId}`, input),
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
    onError: (err) => {
      toast({
        title: "Checkout unavailable",
        description: err instanceof ApiError ? err.message : "Try again later",
        variant: "destructive",
      });
    },
  });
}

export function useBillingPortal(organizationId: string | null) {
  return useMutation({
    mutationFn: () => api.post<{ portalUrl: string }>(`/billing/portal?organizationId=${organizationId}`),
    onSuccess: (data) => {
      window.location.href = data.portalUrl;
    },
    onError: (err) => {
      toast({
        title: "Billing portal unavailable",
        description: err instanceof ApiError ? err.message : "Try again later",
        variant: "destructive",
      });
    },
  });
}
