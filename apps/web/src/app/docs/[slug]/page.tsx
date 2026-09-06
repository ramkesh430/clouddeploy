import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOCS_PAGES, docHref, findDocPage } from "@/lib/docs-content";
import { DocsShell } from "@/components/docs/docs-shell";

export function generateStaticParams() {
  return DOCS_PAGES.filter((p) => p.slug !== "getting-started").map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = findDocPage(params.slug);
  if (!page) return {};
  return {
    title: `${page.title} — CloudDeploy Docs`,
    description: page.description,
    alternates: { canonical: docHref(page.slug) },
  };
}

export default function DocPageRoute({ params }: { params: { slug: string } }) {
  if (!findDocPage(params.slug)) notFound();
  return <DocsShell slug={params.slug} />;
}
