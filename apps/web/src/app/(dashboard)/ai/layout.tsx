import Link from "next/link";

const links = [
  ["/ai", "Repository"],
  ["/ai/logs", "Log analysis"],
  ["/ai/recommendations", "Resources"],
  ["/ai/dockerfile", "Dockerfile"],
];

export default function AILayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-6"><div><h1 className="text-2xl font-semibold tracking-tight">AI Deployment Assistant</h1><p className="text-sm text-muted-foreground">Analyze configuration, explain failures, and review every proposed change before it is applied.</p></div><nav className="flex flex-wrap gap-2">{links.map(([href, label]) => <Link key={href} href={href} className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted">{label}</Link>)}</nav>{children}</div>;
}
