"use client";

import Link from "next/link";
import { Github, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ImportGithubPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/projects/new">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
      </Button>
      <Card>
        <CardHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Github className="h-6 w-6" />
          </div>
          <CardTitle>Connect GitHub</CardTitle>
          <CardDescription>
            GitHub App installation and repository import are being finished as part of Phase 1 of the build. In the
            meantime, deploy from a Docker image or start an empty project and add services manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button disabled className="w-full">
            <Github className="h-4 w-4" /> Connect GitHub (coming soon)
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/projects/new/empty">Start an Empty Project instead</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
