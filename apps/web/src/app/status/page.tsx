import Link from "next/link";
import { Boxes } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const components = ["API", "Dashboard", "Build System", "Runtime", "Database", "Storage", "Domains", "SSL"];

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><Boxes className="h-4 w-4" /></div>
            <span className="text-base font-semibold">CloudDeploy Status</span>
          </Link>
        </div>
      </header>
      <div className="container flex flex-col gap-6 py-16">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-success" />
          <h1 className="text-xl font-semibold">All Systems Operational</h1>
        </div>
        <div className="flex flex-col gap-2">
          {components.map((c) => (
            <Card key={c}>
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <span className="font-medium">{c}</span>
                <span className="flex items-center gap-1.5 text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Operational</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
