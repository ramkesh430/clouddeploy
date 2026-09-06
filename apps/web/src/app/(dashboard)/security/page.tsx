"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSecurityOverview, useTwoFactorEnable, useTwoFactorSetup } from "@/hooks/use-phase3";
import { useDeleteAccount, useExportData } from "@/hooks/use-auth";

export default function SecurityPage() {
  const { data } = useSecurityOverview(); const setup = useTwoFactorSetup(); const enable = useTwoFactorEnable(); const [code, setCode] = useState("");
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">Security settings</h1><p className="text-sm text-muted-foreground">Protect account access, review sessions, and inspect suspicious sign-in events.</p></div><div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Two-factor authentication</CardTitle><Badge variant={data?.twoFactorEnabled ? "success" : "warning"}>{data?.twoFactorEnabled ? "Enabled" : "Not enabled"}</Badge></div></CardHeader><CardContent className="space-y-4">{!data?.twoFactorEnabled && !setup.data && <Button onClick={() => setup.mutate()} loading={setup.isPending}>Start authenticator setup</Button>}{setup.data && <><p className="text-sm">Add this secret to your authenticator:</p><code className="block rounded-md bg-muted p-3 text-sm">{setup.data.secret}</code><div><Label>Six-digit code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div><Button disabled={code.length !== 6} loading={enable.isPending} onClick={() => enable.mutate(code)}>Verify and enable</Button>{enable.data && <div className="rounded-md border border-warning/40 bg-warning/10 p-3"><p className="text-sm font-medium">Save these recovery codes once</p><pre className="mt-2 text-xs">{enable.data.recoveryCodes.join("\n")}</pre></div>}</>}</CardContent></Card><Card><CardHeader><CardTitle>Recent sign-ins</CardTitle></CardHeader><CardContent className="space-y-3">{(data?.loginEvents ?? []).map((event) => <div key={event.id} className="flex items-center justify-between rounded-md border p-3 text-sm"><div><p>{event.ipAddress ?? "Unknown IP"}</p><p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p></div><Badge variant={event.suspicious ? "destructive" : event.successful ? "success" : "warning"}>{event.suspicious ? "Suspicious" : event.successful ? "Successful" : "Failed"}</Badge></div>)}</CardContent></Card></div><DangerZone /></div>;
}

function DangerZone() {
  const exportData = useExportData();
  const deleteAccount = useDeleteAccount();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");

  async function downloadExport() {
    const data = await exportData.mutateAsync();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clouddeploy-data-export.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-md border p-4">
          <div>
            <p className="text-sm font-medium">Export your data</p>
            <p className="text-xs text-muted-foreground">Download a JSON copy of your profile, organizations, and projects.</p>
          </div>
          <Button variant="outline" loading={exportData.isPending} onClick={downloadExport}>
            Export data
          </Button>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-md border border-destructive/40 p-4">
          <div>
            <p className="text-sm font-medium">Delete your account</p>
            <p className="text-xs text-muted-foreground">Permanently deletes your account. This cannot be undone.</p>
          </div>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Delete account
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes your account and revokes all sessions. If you solely own a team workspace, it&apos;s
            deleted with you — transfer ownership first if others still need access.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password">Confirm your password</Label>
            <Input id="confirm-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {deleteAccount.isError && <p className="text-xs text-destructive">{(deleteAccount.error as Error).message}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={deleteAccount.isPending} disabled={!password} onClick={() => deleteAccount.mutate(password)}>
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
