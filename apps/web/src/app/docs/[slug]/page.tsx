import { notFound } from "next/navigation";
import { DOCS_PAGES, findDocPage } from "@/lib/docs-content";
import { DocsShell } from "@/components/docs/docs-shell";

export function generateStaticParams() {
  return DOCS_PAGES.filter((p) => p.slug !== "getting-started").map((p) => ({ slug: p.slug }));
}

export default function DocPageRoute({ params }: { params: { slug: string } }) {
  if (!findDocPage(params.slug)) notFound();
  return <DocsShell slug={params.slug} />;
}
