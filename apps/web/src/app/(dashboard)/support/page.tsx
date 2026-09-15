"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useCreateSupportTicket, useSupportTickets } from "@/hooks/use-phase3";
import { formatRelativeTime } from "@/lib/utils";

export default function SupportPage() {
  const { active } = useActiveOrganization();
  const { data } = useSupportTickets(active?.id);
  const create = useCreateSupportTicket();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [category, setCategory] = useState("GENERAL");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
        <p className="text-sm text-muted-foreground">
          Open a ticket and keep the full conversation attached to your workspace.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Your tickets</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(data ?? []).length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No tickets yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Subject</th>
                      <th className="px-5 py-3 font-medium">Priority</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data ?? []).map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-5 py-3">
                          <p className="font-medium">{ticket.subject}</p>
                          <p className="text-xs text-muted-foreground">{ticket.category}</p>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant="outline">{ticket.priority}</Badge>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={ticket.status === "RESOLVED" ? "success" : "secondary"}>
                            {ticket.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {formatRelativeTime(ticket.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open ticket</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {["GENERAL", "BILLING", "DEPLOYMENT", "DATABASE", "DOMAIN", "SECURITY", "ABUSE"].map(
                  (item) => (
                    <option key={item}>{item}</option>
                  ),
                )}
              </select>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {["LOW", "NORMAL", "HIGH", "URGENT"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <textarea
              className="min-h-32 w-full rounded-md border border-input bg-background p-3 text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help?"
            />
            <Button
              className="w-full"
              disabled={!active || !subject || !message}
              loading={create.isPending}
              onClick={() =>
                active &&
                create.mutate(
                  { organizationId: active.id, subject, category, priority, message },
                  {
                    onSuccess: () => {
                      setSubject("");
                      setMessage("");
                    },
                  },
                )
              }
            >
              Open ticket
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
