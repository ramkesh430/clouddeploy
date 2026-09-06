import { formatBytes, formatCurrency, formatRelativeTime, cn } from "./utils";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
});

describe("formatBytes", () => {
  it("formats zero bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes without a decimal", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes, megabytes, and gigabytes with one decimal", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
  });
});

describe("formatCurrency", () => {
  it("formats a dollar amount", () => {
    expect(formatCurrency(15)).toBe("$15.00");
  });

  it("formats a fractional amount", () => {
    expect(formatCurrency(9.5)).toBe("$9.50");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-01T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns 'just now' for a moment ago", () => {
    expect(formatRelativeTime(new Date("2026-01-01T11:59:50Z"))).toBe("just now");
  });

  it("returns minutes ago", () => {
    expect(formatRelativeTime(new Date("2026-01-01T11:45:00Z"))).toBe("15m ago");
  });

  it("returns hours ago", () => {
    expect(formatRelativeTime(new Date("2026-01-01T09:00:00Z"))).toBe("3h ago");
  });

  it("returns days ago", () => {
    expect(formatRelativeTime(new Date("2025-12-29T12:00:00Z"))).toBe("3d ago");
  });

  it("accepts an ISO string as well as a Date", () => {
    expect(formatRelativeTime("2026-01-01T11:59:50Z")).toBe("just now");
  });
});
