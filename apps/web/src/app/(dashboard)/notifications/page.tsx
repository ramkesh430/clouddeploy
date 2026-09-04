import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">Deployment, backup, resource and billing alerts.</p>
      </div>
      <ComingSoon
        title="Notification Center"
        description="In-app, email and webhook delivery for deployment/backup/resource alerts land once the notification dispatcher is wired to BullMQ in Phase 2."
      />
    </div>
  );
}
