import Link from "next/link";
import { Boxes, Github, Linkedin, Twitter, Youtube } from "lucide-react";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="container flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-3.5 w-3.5" />
          </div>
          <span className="font-semibold text-foreground">CloudDeploy</span>
          <span className="hidden text-muted-foreground sm:inline">· Build without limits.</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5">
          <Link href="/product" className="hover:text-foreground">Product</Link>
          <Link href="/features" className="hover:text-foreground">Features</Link>
          <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link href="/docs" className="hover:text-foreground">Docs</Link>
          <Link href="/status" className="hover:text-foreground">Status</Link>
        </div>

        <div className="flex items-center gap-4">
          <Github className="h-4 w-4" />
          <Twitter className="h-4 w-4" />
          <Youtube className="h-4 w-4" />
          <Linkedin className="h-4 w-4" />
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} CloudDeploy. All rights reserved.
      </div>
    </footer>
  );
}
