import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("@/hooks/use-auth", () => ({
  useLogout: () => ({ mutate: jest.fn() }),
}));

jest.mock("@/lib/store/auth-store", () => ({
  useAuthStore: (selector: (state: { user: { fullName: string; email: string } | null }) => unknown) =>
    selector({ user: { fullName: "Ada Admin", email: "admin@clouddeploy.dev" } }),
}));

describe("Sidebar", () => {
  it("highlights the nav link matching the current path", () => {
    (usePathname as jest.Mock).mockReturnValue("/projects");
    render(<Sidebar />);
    const projectsLink = screen.getByRole("link", { name: /projects/i });
    expect(projectsLink).toHaveAttribute("aria-current", "page");
  });

  it("highlights a nested route under its parent link", () => {
    (usePathname as jest.Mock).mockReturnValue("/projects/abc123/services");
    render(<Sidebar />);
    const projectsLink = screen.getByRole("link", { name: /projects/i });
    expect(projectsLink).toHaveAttribute("aria-current", "page");
  });

  it("does not highlight unrelated links", () => {
    (usePathname as jest.Mock).mockReturnValue("/projects");
    render(<Sidebar />);
    const billingLink = screen.getByRole("link", { name: /billing/i });
    expect(billingLink).not.toHaveAttribute("aria-current");
  });

  it("shows the current user's name and email", () => {
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
    render(<Sidebar />);
    expect(screen.getByText("Ada Admin")).toBeInTheDocument();
    expect(screen.getByText("admin@clouddeploy.dev")).toBeInTheDocument();
  });
});
