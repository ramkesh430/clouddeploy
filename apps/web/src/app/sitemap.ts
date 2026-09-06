import type { MetadataRoute } from "next";
import { DOCS_PAGES, docHref } from "@/lib/docs-content";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://clouddeploy.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/product", "/features", "/pricing", "/status", "/terms", "/privacy"];
  const docRoutes = DOCS_PAGES.map((p) => docHref(p.slug));

  return [...routes, ...docRoutes].map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.6,
  }));
}
