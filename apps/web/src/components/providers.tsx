"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { initErrorTracking } from "@/lib/error-tracking";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { useSyncCurrentUser } from "@/hooks/use-auth";

/** Needs to render inside QueryClientProvider, so it can't just be a call
 * in Providers' own body — that runs before the provider is established. */
function SyncCurrentUser() {
  useSyncCurrentUser();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initErrorTracking();
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SyncCurrentUser />
      <ImpersonationBanner />
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
