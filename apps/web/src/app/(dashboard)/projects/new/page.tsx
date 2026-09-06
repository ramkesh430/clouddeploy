"use client";

import Link from "next/link";
import { Github, Container, LayoutTemplate, FileBox, KeySquare, Settings2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useGithubConnections, useConnectGithub } from "@/hooks/use-github";

const quickStarts = [
  { href: "/projects/new/import", icon: Github, label: "Import from GitHub", variant: "default" as const },
  { href: "/projects/new/empty?mode=docker", icon: Container, label: "Deploy with Docker", variant: "outline" as const },
  { href: "/templates", icon: LayoutTemplate, label: "Start from Template", variant: "outline" as const },
  { href: "/projects/new/empty", icon: FileBox, label: "Empty Project", variant: "outline" as const },
];

const howItWorks = [
  { icon: Github, title: "Connect GitHub", description: "Authorize and select a repository." },
  { icon: Settings2, title: "Configure Services", description: "We detect your stack automatically." },
  { icon: Rocket, title: "Deploy", description: "Your application goes live." },
];

export default function NewProjectPage() {
  const { active } = useActiveOrganization();
  const { data: connections, isLoading: connectionsLoading } = useGithubConnections(active?.id ?? null);
  const connectGithub = useConnectGithub();
  const isConnected = !connectionsLoading && (connections?.length ?? 0) > 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create Project</h1>
        <p className="text-sm text-muted-foreground">Connect your repository and deploy in minutes.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {quickStarts.map((opt) => (
          <Button key={opt.label} variant={opt.variant} asChild>
            <Link href={opt.href}>
              <opt.icon className="h-4 w-4" /> {opt.label}
            </Link>
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Github className="h-6 w-6" />
            </div>
            <CardTitle>Connect GitHub</CardTitle>
            <CardDescription>Authorize with GitHub to import your repositories.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isConnected ? (
              <Button className="w-full" asChild>
                <Link href="/projects/new/import">
                  <Github className="h-4 w-4" /> Browse repositories
                </Link>
              </Button>
            ) : (
              <Button className="w-full" loading={connectGithub.isPending} onClick={() => active && connectGithub.mutate(active.id)}>
                <Github className="h-4 w-4" /> Connect GitHub
              </Button>
            )}
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <KeySquare className="h-3 w-3" /> We only read your repositories. No code is stored on our servers.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {howItWorks.map((step, i) => (
              <div key={step.title} className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
