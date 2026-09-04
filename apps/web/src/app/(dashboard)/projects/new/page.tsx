"use client";

import Link from "next/link";
import { Github, Container, LayoutTemplate, FileBox, ArrowRight, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const options = [
  {
    href: "/projects/new/import",
    icon: Github,
    title: "Import GitHub Repository",
    description: "Connect a repository and CloudDeploy detects your stack automatically.",
    badge: "Requires GitHub connection",
  },
  {
    href: "/projects/new/empty?mode=docker",
    icon: Container,
    title: "Deploy Docker Image",
    description: "Bring any Dockerfile — Docker is the universal fallback for any web app.",
  },
  {
    href: "/templates",
    icon: LayoutTemplate,
    title: "Deploy Template",
    description: "Start from a ready-made stack: Next.js, MERN, Laravel + MySQL, and more.",
    badge: "Coming soon",
  },
  {
    href: "/projects/new/empty",
    icon: FileBox,
    title: "Empty Project",
    description: "Start from scratch and add services, databases, and Redis one at a time.",
  },
];

export default function NewProjectPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create a new project</h1>
        <p className="text-sm text-muted-foreground">Choose how you&apos;d like to start.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {options.map((opt) => (
          <Link key={opt.title} href={opt.href}>
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <opt.icon className="h-5 w-5" />
                  </div>
                  {opt.badge && (
                    <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <Clock className="h-3 w-3" /> {opt.badge}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold">{opt.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{opt.description}</p>
                </div>
                <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
