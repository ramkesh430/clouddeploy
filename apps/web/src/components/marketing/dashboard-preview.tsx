import {
  Activity,
  Boxes,
  CheckCircle2,
  Database,
  Globe2,
  HardDrive,
  LayoutDashboard,
  LockKeyhole,
  Rocket,
  Server,
  Settings,
  Users,
} from "lucide-react";

const sidebarItems = [
  { label: "Projects", icon: LayoutDashboard, active: true },
  { label: "Deployments", icon: Rocket },
  { label: "Databases", icon: Database },
  { label: "Storage", icon: HardDrive },
  { label: "Domains", icon: Globe2 },
  { label: "Monitoring", icon: Activity },
  { label: "Team", icon: Users },
  { label: "Settings", icon: Settings },
];

const services = [
  { name: "Frontend", sub: "Next.js", icon: Boxes, status: "Running" },
  { name: "Backend", sub: "Node.js", icon: Server, status: "Running" },
  { name: "Database", sub: "PostgreSQL", icon: Database, status: "Running" },
  { name: "Storage", sub: "S3 Compatible", icon: HardDrive, status: "Active" },
  { name: "Domain", sub: "app.acme.com", icon: Globe2, status: "Active" },
  { name: "SSL", sub: "Let's Encrypt", icon: LockKeyhole, status: "Active" },
];

const deployments = [
  { message: "Add user authentication", sha: "a3f9e1c", time: "2 minutes ago" },
  { message: "Update UI components", sha: "b7c9d4a", time: "12 minutes ago" },
  { message: "Fix database connection", sha: "c3e8f2d", time: "1 hour ago" },
];

/** A stylized, illustrative recreation of the real dashboard used across the
 * marketing pages — built from the same color tokens as the actual product
 * (see apps/web/src/app/(dashboard)), not a fabricated screenshot. */
export function DashboardPreview() {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-background shadow-2xl">
      <div className="grid grid-cols-[44px_1fr] sm:grid-cols-[150px_1fr]">
        <aside className="flex flex-col gap-1 bg-sidebar p-3 text-sidebar-foreground">
          <div className="mb-2 hidden items-center gap-1.5 text-xs font-bold text-white sm:flex">
            <Boxes className="h-3.5 w-3.5 text-primary" /> CloudDeploy
          </div>
          {sidebarItems.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${item.active ? "bg-white/10 text-white" : "text-sidebar-foreground/70"}`}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{item.label}</span>
            </div>
          ))}
        </aside>

        <main className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold">Acme Web App</p>
              <p className="text-[10px] text-muted-foreground">github.com/acme/webapp · main · Deployed 2m ago</p>
            </div>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">● Live</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {services.map((service) => (
              <div key={service.name} className="flex flex-col gap-2 rounded-md border border-border p-2">
                <service.icon className="h-3.5 w-3.5 text-primary" />
                <div>
                  <p className="truncate text-[11px] font-semibold">{service.name}</p>
                  <p className="truncate text-[9px] text-muted-foreground">{service.sub}</p>
                </div>
                <span className="flex w-fit items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[8px] text-success">
                  <CheckCircle2 className="h-2 w-2" /> {service.status}
                </span>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1 text-[10px] font-bold">Recent Deployments</p>
            <div className="flex flex-col rounded-md border border-border">
              {deployments.map((d) => (
                <div key={d.sha} className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5 text-[9px] last:border-0">
                  <span className="truncate text-foreground">● {d.message}</span>
                  <code className="shrink-0 text-muted-foreground">{d.sha}</code>
                  <span className="hidden shrink-0 text-muted-foreground sm:inline">{d.time}</span>
                  <span className="shrink-0 rounded-full bg-success/15 px-1.5 py-0.5 text-success">Success</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
