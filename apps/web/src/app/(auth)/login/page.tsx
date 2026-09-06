"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import { useLogin } from "@/hooks/use-auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  otpCode: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const login = useLogin();
  const [needsOtp, setNeedsOtp] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(values: FormValues) {
    login.mutate(values, {
      onError: (err) => {
        if (err instanceof ApiError && err.message.toLowerCase().includes("two-factor")) setNeedsOtp(true);
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Log in to CloudDeploy</CardTitle>
        <CardDescription>Deploy your entire application in minutes.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" disabled={needsOtp} {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input id="password" type="password" placeholder="••••••••" disabled={needsOtp} {...register("password")} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          {needsOtp && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="otpCode">Two-factor code</Label>
              <Input id="otpCode" placeholder="123456" autoFocus maxLength={16} {...register("otpCode")} />
              <p className="text-xs text-muted-foreground">Enter the 6-digit code from your authenticator app, or a recovery code.</p>
            </div>
          )}
          <Button type="submit" className="w-full" loading={login.isPending}>
            {needsOtp ? "Verify and log in" : "Login"}
          </Button>
          {needsOtp && (
            <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setNeedsOtp(false)}>
              Use a different account
            </button>
          )}
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create Account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
