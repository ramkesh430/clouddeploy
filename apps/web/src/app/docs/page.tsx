import type { Metadata } from "next";
import { DocsShell } from "@/components/docs/docs-shell";
import { findDocPage } from "@/lib/docs-content";

const page = findDocPage("getting-started")!;

export const metadata: Metadata = {
  title: `${page.title} — CloudDeploy Docs`,
  description: page.description,
  alternates: { canonical: "/docs" },
};

export default function DocsIndexPage() {
  return <DocsShell slug="getting-started" />;
}
