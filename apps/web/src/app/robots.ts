import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://clouddeploy.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/projects", "/databases", "/storage", "/admin", "/onboarding", "/api-keys", "/team", "/billing", "/settings", "/security"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
