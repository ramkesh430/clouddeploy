export function DraftNotice() {
  return (
    <div className="mt-6 rounded-md border border-warning/40 bg-warning/10 p-4 text-sm">
      <p className="font-medium text-warning-foreground">Draft template — not legal advice</p>
      <p className="mt-1 text-muted-foreground">
        This page is a structural starting point for a lawyer to review and adapt, not reviewed legal text. Every
        bracketed value (company name, jurisdiction, contact details, etc.) needs to be filled in, and the whole
        document needs review by qualified counsel before any real user accepts it. Do not treat this as binding
        until that review is complete.
      </p>
    </div>
  );
}
