import { render, screen } from "@testing-library/react";
import { CircularProgress } from "./circular-progress";

describe("CircularProgress", () => {
  it("renders the percentage label by default", () => {
    render(<CircularProgress value={42} />);
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("rounds a fractional value for display", () => {
    render(<CircularProgress value={42.6} />);
    expect(screen.getByText("43%")).toBeInTheDocument();
  });

  it("clamps a value above 100 to a full ring", () => {
    const { container } = render(<CircularProgress value={150} />);
    const circles = container.querySelectorAll("circle");
    const progressCircle = circles[1];
    expect(progressCircle).toHaveAttribute("stroke-dashoffset", "0");
  });

  it("clamps a negative value to an empty ring", () => {
    render(<CircularProgress value={-10} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("renders custom children instead of the default label", () => {
    render(
      <CircularProgress value={50}>
        <span>Custom</span>
      </CircularProgress>,
    );
    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.queryByText("50%")).not.toBeInTheDocument();
  });

  it("applies the given color class to the progress arc", () => {
    const { container } = render(<CircularProgress value={50} colorClassName="stroke-destructive" />);
    const circles = container.querySelectorAll("circle");
    expect(circles[1]?.getAttribute("class")).toContain("stroke-destructive");
  });
});
