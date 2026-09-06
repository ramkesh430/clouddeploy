"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const TOPICS = [
  { value: "sales", label: "Enterprise sales", to: "sales@clouddeploy.dev" },
  { value: "support", label: "Technical support", to: "support@clouddeploy.dev" },
  { value: "other", label: "Something else", to: "hello@clouddeploy.dev" },
];

export function ContactForm() {
  const searchParams = useSearchParams();
  const defaultTopic = searchParams.get("plan") === "enterprise" ? "sales" : "other";
  const [topic, setTopic] = useState(defaultTopic);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const to = TOPICS.find((t) => t.value === topic)?.to ?? "hello@clouddeploy.dev";
  const subject = encodeURIComponent(`[${TOPICS.find((t) => t.value === topic)?.label}] ${name || "New inquiry"}`);
  const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
  const mailtoHref = `mailto:${to}?subject=${subject}&body=${body}`;

  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="p-6">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            window.location.href = mailtoHref;
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="topic">What&apos;s this about?</Label>
            <select id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {TOPICS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded-md border border-input bg-background p-3 text-sm"
            />
          </div>
          <Button type="submit">Send message</Button>
          <p className="text-center text-xs text-muted-foreground">
            Opens your email client addressed to {to} — nothing is sent from this page directly.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
