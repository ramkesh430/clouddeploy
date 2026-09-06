"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { initErrorTracking } from "@/lib/error-tracking";
import { ImpersonationBanner } from "@/components/impersonation-banner";

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
      <ImpersonationBanner />
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
