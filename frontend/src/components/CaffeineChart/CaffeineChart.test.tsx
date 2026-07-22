import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CaffeineChart } from "./CaffeineChart";
import { computeDecayCurve, mgAtHour } from "./caffeineCalc";

describe("CaffeineChart", () => {
  it("renders nothing with empty points", () => {
    const { container } = render(
      <CaffeineChart points={[]} bedtimeHour={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders SVG with points", () => {
    const points = [
      { hour: 0, mg: 0 },
      { hour: 8, mg: 100 },
      { hour: 12, mg: 50 },
    ];
    const { container } = render(
      <CaffeineChart points={points} bedtimeHour={22.5} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders polyline", () => {
    const points = [
      { hour: 0, mg: 0 },
      { hour: 8, mg: 100 },
    ];
    const { container } = render(
      <CaffeineChart points={points} bedtimeHour={null} />,
    );
    const polyline = container.querySelector("polyline");
    expect(polyline).toBeInTheDocument();
  });

  it("renders threshold line when max >= 100", () => {
    const points = [{ hour: 8, mg: 200 }];
    const { container } = render(
      <CaffeineChart points={points} bedtimeHour={null} />,
    );
    // Find the 100mg text label
    const texts = container.querySelectorAll("text");
    const has100mg = Array.from(texts).some((t) => t.textContent === "100mg");
    expect(has100mg).toBe(true);
  });

  it("renders bedtime marker when provided", () => {
    const points = [{ hour: 8, mg: 100 }];
    const { container } = render(
      <CaffeineChart points={points} bedtimeHour={22} />,
    );
    const lines = container.querySelectorAll("line");
    // Should have at least 3 lines: axes + threshold + bedtime
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it("labels the bedtime marker with a 12-hour clock time", () => {
    const points = [{ hour: 8, mg: 100 }];
    render(<CaffeineChart points={points} bedtimeHour={22.5} />);
    expect(screen.getByText("Bedtime 10:30 PM")).toBeInTheDocument();
  });

  it("shows the modeled mg-at-bedtime callout from the decay curve", () => {
    // 200mg at 14:00, normal half-life (4h) => 8h to a 22:00 bedtime => 50mg.
    const points = computeDecayCurve(
      [{ time: "14:00:00", amount_mg: 200 }],
      "normal",
    );
    const expectedMg = Math.round(mgAtHour(points, 22));
    expect(expectedMg).toBe(50);
    render(<CaffeineChart points={points} bedtimeHour={22} />);
    expect(
      screen.getByText(`≈${expectedMg} mg at bedtime`),
    ).toBeInTheDocument();
  });

  it("renders no bedtime label or callout without a bedtime", () => {
    const points = computeDecayCurve(
      [{ time: "14:00:00", amount_mg: 200 }],
      "normal",
    );
    render(<CaffeineChart points={points} bedtimeHour={null} />);
    expect(screen.queryByText(/Bedtime/)).not.toBeInTheDocument();
    expect(screen.queryByText(/at bedtime/)).not.toBeInTheDocument();
  });

  it("labels the y-axis floor with 0mg", () => {
    const points = [{ hour: 8, mg: 100 }];
    render(<CaffeineChart points={points} bedtimeHour={null} />);
    expect(screen.getByText("0mg")).toBeInTheDocument();
  });
});
