import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./badge";

describe("StatusBadge", () => {
  it("renders a known status with its mapped label", () => {
    render(<StatusBadge status="RUNNING" />);
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("maps FAILED to a destructive-styled badge", () => {
    render(<StatusBadge status="FAILED" />);
    const badge = screen.getByText("Failed");
    expect(badge.className).toContain("bg-destructive");
  });

  it("maps LIVE and RUNNING to the same success styling", () => {
    render(<StatusBadge status="LIVE" />);
    const live = screen.getByText("Live");
    expect(live.className).toContain("bg-success");
  });

  it("falls back to the raw status string for an unknown status", () => {
    render(<StatusBadge status="SOMETHING_UNMAPPED" />);
    expect(screen.getByText("SOMETHING_UNMAPPED")).toBeInTheDocument();
  });
});
