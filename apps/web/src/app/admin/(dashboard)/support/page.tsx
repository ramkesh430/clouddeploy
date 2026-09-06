"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { useAdminResource } from "@/hooks/use-phase3";

interface TicketListItem {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  updatedAt: string;
  user: { fullName: string; email: string };
  assignedAdmin: { fullName: string } | null;
  _count: { messages: number };
}

interface TicketMessage { id: string; body: string; isAdmin: boolean; createdAt: string; author: { fullName: string } }
interface TicketDetail extends TicketListItem {
  messages: TicketMessage[];
}

const STATUS_OPTIONS = ["OPEN", "WAITING_USER", "WAITING_SUPPORT", "RESOLVED", "CLOSED"];
const PRIORITY_OPTIONS = ["LOW", "NORMAL", "HIGH", "URGENT"];

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  WAITING_USER: "bg-amber-100 text-amber-800",
  WAITING_SUPPORT: "bg-violet-100 text-violet-800",
  RESOLVED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-muted text-muted-foreground",
};

export default function AdminSupportPage() {
  const { data: tickets = [], isLoading } = useAdminResource<TicketListItem[]>("/admin/support/tickets");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Support tickets</h1>
        <p className="text-sm text-muted-foreground">Customer issues, priority, assignment, and response state.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit">
          <CardHeader><CardTitle>All tickets ({tickets.length})</CardTitle></CardHeader>
          <CardContent className="max-h-[70vh] space-y-1 overflow-y-auto p-2">
            {isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : tickets.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No support tickets.</p>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedId(ticket.id)}
                  className={`w-full rounded-md p-3 text-left text-sm transition-colors hover:bg-muted ${selectedId === ticket.id ? "bg-muted" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{ticket.subject}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[ticket.status] ?? "bg-muted"}`}>{ticket.status.replace("_", " ")}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{ticket.user.email} · {ticket.category} · {ticket.priority}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {selectedId ? <TicketDetailPanel ticketId={selectedId} /> : (
          <Card><CardContent className="flex h-full min-h-[300px] items-center justify-center p-6 text-sm text-muted-foreground">Select a ticket to view the conversation.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function TicketDetailPanel({ ticketId }: { ticketId: string }) {
  const client = useQueryClient();
  const [reply, setReply] = useState("");
  const { data: ticket, isLoading } = useQuery({ queryKey: ["admin", `/admin/support/tickets/${ticketId}`], queryFn: () => api.get<TicketDetail>(`/admin/support/tickets/${ticketId}`) });

  const invalidate = () => {
    client.invalidateQueries({ queryKey: ["admin", `/admin/support/tickets/${ticketId}`] });
    client.invalidateQueries({ queryKey: ["admin", "/admin/support/tickets"] });
  };
  const updateMutation = useMutation({ mutationFn: (dto: { status?: string; priority?: string }) => api.patch(`/admin/support/tickets/${ticketId}`, dto), onSuccess: invalidate });
  const replyMutation = useMutation({
    mutationFn: (message: string) => api.post(`/admin/support/tickets/${ticketId}/messages`, { message }),
    onSuccess: () => { setReply(""); invalidate(); },
  });

  function submitReply(event: FormEvent) {
    event.preventDefault();
    if (reply.trim()) replyMutation.mutate(reply.trim());
  }

  if (isLoading || !ticket) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{ticket.subject}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{ticket.user.fullName} ({ticket.user.email}) · {ticket.category}</p>
          </div>
          <div className="flex gap-2">
            <select className="h-8 rounded-md border bg-background px-2 text-xs" value={ticket.status} onChange={(e) => updateMutation.mutate({ status: e.target.value })}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
            <select className="h-8 rounded-md border bg-background px-2 text-xs" value={ticket.priority} onChange={(e) => updateMutation.mutate({ priority: e.target.value })}>
              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="max-h-[45vh] space-y-3 overflow-y-auto rounded-md border p-3">
          {ticket.messages.map((message) => (
            <div key={message.id} className={`max-w-[80%] rounded-lg p-3 text-sm ${message.isAdmin ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
              <p className="mb-1 text-xs opacity-70">{message.author.fullName} · {new Date(message.createdAt).toLocaleString()}</p>
              <p className="whitespace-pre-wrap">{message.body}</p>
            </div>
          ))}
        </div>
        <form onSubmit={submitReply} className="flex gap-2">
          <textarea
            className="min-h-16 flex-1 rounded-md border bg-background p-2 text-sm"
            placeholder="Reply to this ticket…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <Button type="submit" disabled={replyMutation.isPending || !reply.trim()}>Send</Button>
        </form>
      </CardContent>
    </Card>
  );
}

