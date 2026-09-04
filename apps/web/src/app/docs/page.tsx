import Link from "next/link";
import { Boxes, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const sections = [
  "Getting Started", "Deploy Node.js", "Deploy Next.js", "Deploy React", "Deploy Laravel",
  "Deploy Django", "Deploy Docker", "Databases", "Domains", "Environment Variables",
  "Storage", "Cron Jobs", "Workers", "Billing", "API", "CLI", "Troubleshooting",
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><Boxes className="h-4 w-4" /></div>
            <span className="text-base font-semibold">CloudDeploy</span>
          </Link>
          <Button variant="ghost" size="sm" asChild><Link href="/"><ArrowLeft className="h-3.5 w-3.5" /> Back</Link></Button>
        </div>
      </header>
      <div className="container flex flex-col gap-6 py-16">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documentation</h1>
          <p className="text-sm text-muted-foreground">Guides for deploying and operating on CloudDeploy. Full docs content is being written alongside each feature as it ships.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {sections.map((s) => (
            <Card key={s}><CardContent className="p-4 text-sm font-medium text-muted-foreground">{s}</CardContent></Card>
          ))}
        </div>
      </div>
    </div>
  );
}
