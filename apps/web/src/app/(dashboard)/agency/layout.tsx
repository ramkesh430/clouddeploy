import Link from "next/link";

const links = [["/agency", "Overview"], ["/agency/clients", "Clients"], ["/agency/settings", "Agency settings"], ["/agency/white-label", "White label"]];
export default function AgencyLayout({ children }: { children: React.ReactNode }) { return <div className="flex flex-col gap-6"><div><h1 className="text-2xl font-semibold tracking-tight">Agency workspace</h1><p className="text-sm text-muted-foreground">Manage client infrastructure, margins, access, and your customer-facing brand.</p></div><nav className="flex flex-wrap gap-2">{links.map(([href, label]) => <Link href={href} key={href} className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted">{label}</Link>)}</nav>{children}</div>; }
