"use client";

import { Check, CheckCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  useNotificationPreferences,
  useSetPreference,
  NOTIFICATION_TYPES,
} from "@/hooks/use-notifications";
import { formatRelativeTime, cn } from "@/lib/utils";

const CHANNELS = ["IN_APP", "EMAIL"] as const;

export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">Deployment, backup, resource and billing alerts.</p>
      </div>
      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox"><Inbox /></TabsContent>
        <TabsContent value="preferences"><Preferences /></TabsContent>
      </Tabs>
    </div>
  );
}

function Inbox() {
  const { data: notifications } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const unread = (notifications ?? []).filter((n) => !n.readAt).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" disabled={unread === 0} onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
          <CheckCheck className="h-3.5 w-3.5" /> Mark all read
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {(notifications ?? []).map((n) => (
          <Card key={n.id} className={cn(!n.readAt && "border-primary/40 bg-primary/[0.03]")}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {!n.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  <p className="text-sm font-medium">{n.title}</p>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(n.createdAt)}</p>
              </div>
              {!n.readAt && (
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => markRead.mutate(n.id)}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {(notifications ?? []).length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No notifications yet.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function Preferences() {
  const { data: preferences } = useNotificationPreferences();
  const setPreference = useSetPreference();

  const isEnabled = (type: string, channel: string) => {
    const pref = preferences?.find((p) => p.type === type && p.channel === channel);
    return pref ? pref.enabled : true;
  };

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="p-4 font-medium">Event</th>
              {CHANNELS.map((c) => <th key={c} className="p-4 text-center font-medium">{c.replace("_", "-")}</th>)}
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_TYPES.map((type) => (
              <tr key={type} className="border-b border-border/60 last:border-0">
                <td className="p-4"><Badge variant="outline">{type.replace(/_/g, " ")}</Badge></td>
                {CHANNELS.map((channel) => {
                  const enabled = isEnabled(type, channel);
                  return (
                    <td key={channel} className="p-4 text-center">
                      <button
                        onClick={() => setPreference.mutate({ type, channel, enabled: !enabled })}
                        className={cn(
                          "inline-flex h-5 w-9 items-center rounded-full transition-colors",
                          enabled ? "bg-primary" : "bg-muted",
                        )}
                      >
                        <span
                          className={cn(
                            "h-4 w-4 rounded-full bg-white shadow transition-transform",
                            enabled ? "translate-x-4" : "translate-x-0.5",
                          )}
                        />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
