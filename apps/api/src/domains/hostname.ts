/** Turns a project name or slug into a DNS-safe label (RFC 1123). */
export function sanitizeDnsSlug(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  return slug || "project";
}

export function platformHostname(slug: string, platformDomain: string): string {
  return `${sanitizeDnsSlug(slug)}.${platformDomain.replace(/^\./, "")}`;
}

export function looksLikeHttpUrl(value: string | null | undefined): boolean {
  return !!value && /^https?:\/\//i.test(value);
}

export function hostnameFromUrl(value: string): string {
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).hostname;
  } catch {
    return value.replace(/^https?:\/\//, "").split("/")[0] ?? value;
  }
}

/** A URL we can actually open: a working tunnel, localhost, or a verified public host. */
export function isReachableLiveUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const host = hostnameFromUrl(url);
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host.endsWith(".trycloudflare.com")) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return false;
}
