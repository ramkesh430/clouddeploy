import Link from "next/link";
import { Boxes } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/30 px-4 py-12">
      <Link href="/" className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Boxes className="h-4.5 w-4.5" />
        </div>
        <span className="text-lg font-semibold">CloudDeploy</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
