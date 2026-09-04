"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api-client";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<"idle" | "verifying" | "success" | "error">(token ? "verifying" : "idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setState("success"))
      .catch((err) => {
        setState("error");
        setError(err instanceof ApiError ? err.message : "Verification failed");
      });
  }, [token]);

  return (
    <Card>
      <CardHeader className="items-center text-center">
        {state === "idle" && <Mail className="h-10 w-10 text-primary" />}
        {state === "verifying" && <Loader2 className="h-10 w-10 animate-spin text-primary" />}
        {state === "success" && <CheckCircle2 className="h-10 w-10 text-success" />}
        {state === "error" && <XCircle className="h-10 w-10 text-destructive" />}
        <CardTitle className="text-xl">
          {state === "idle" && "Verify your email"}
          {state === "verifying" && "Verifying..."}
          {state === "success" && "Email verified"}
          {state === "error" && "Verification failed"}
        </CardTitle>
        <CardDescription>
          {state === "idle" && "We sent a verification link to your inbox. Click it to activate your account."}
          {state === "verifying" && "Hang tight, confirming your email address."}
          {state === "success" && "Your email has been verified. You're all set."}
          {state === "error" && (error ?? "This verification link is invalid or has expired.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {state === "success" ? (
          <Button asChild className="w-full">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        ) : (
          <Button variant="outline" className="w-full" type="button">
            Resend verification
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
