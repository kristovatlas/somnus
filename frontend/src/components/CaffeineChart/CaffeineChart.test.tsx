import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CaffeineChart } from "./CaffeineChart";
import {
  computeDecayCurve,
  curveEndHour,
  formatClockLabel,
  mgAtHour,
} from "./caffeineCalc";

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

  it("wraps an after-midnight bedtime onto the evening scale", () => {
    // 200 mg at 14:00, normal sensitivity (4 h half-life). Bedtime 00:30
    // parses to 0.5 at the call sites; the chart wraps it to 24.5, so
    // elapsed = 10.5 h and the modeled level is 200 * 0.5^(10.5/4)
    // ≈ 32.4 mg -> "≈32 mg" (NOT the 0 mg the unwrapped 0.5 would read
    // off a curve where every entry is still in the future).
    const points = computeDecayCurve(
      [{ time: "14:00:00", amount_mg: 200 }],
      "normal",
      curveEndHour(0.5),
    );
    // The curve extends past 24 h to reach the wrapped bedtime.
    expect(curveEndHour(0.5)).toBe(25);
    expect(points[points.length - 1].hour).toBe(24.75);
    expect(Math.round(mgAtHour(points, 24.5))).toBe(32);

    const { container } = render(
      <CaffeineChart points={points} bedtimeHour={0.5} />,
    );
    expect(screen.getByText("≈32 mg at bedtime")).toBeInTheDocument();

    // Marker label wraps to a real clock time and end-anchors (24.5 > 18)
    // so the text stays inside the plot near the right edge.
    const label = screen.getByText("Bedtime 12:30 AM");
    expect(label).toBeInTheDocument();
    expect(label.getAttribute("text-anchor")).toBe("end");

    // The marker line itself sits inside the plot, past the 24 h position:
    // with the domain extended to 25 h, x(24) = 558.8 and the plot's right
    // edge is 580; x(24.5) = 569.4.
    const marker = Array.from(container.querySelectorAll("line")).find(
      (l) => l.getAttribute("stroke") === "var(--color-error)",
    );
    expect(marker).toBeDefined();
    const markerX = Number(marker!.getAttribute("x1"));
    expect(markerX).toBeCloseTo(569.4, 5);
    expect(markerX).toBeGreaterThan(558.8);
    expect(markerX).toBeLessThanOrEqual(580);
  });

  it("keeps the evening-bedtime case on the standard 24 h domain", () => {
    // Regression for the pre-wrap behavior: 22:00 bedtime is untouched.
    expect(curveEndHour(22)).toBe(24);
    const points = computeDecayCurve(
      [{ time: "14:00:00", amount_mg: 200 }],
      "normal",
      curveEndHour(22),
    );
    expect(points).toHaveLength(96);
    render(<CaffeineChart points={points} bedtimeHour={22} />);
    expect(screen.getByText("≈50 mg at bedtime")).toBeInTheDocument();
    expect(screen.getByText("Bedtime 10:00 PM")).toBeInTheDocument();
  });

  it("labels the y-axis floor with 0mg", () => {
    const points = [{ hour: 8, mg: 100 }];
    render(<CaffeineChart points={points} bedtimeHour={null} />);
    expect(screen.getByText("0mg")).toBeInTheDocument();
  });
});

describe("formatClockLabel", () => {
  it("formats midnight as 12:00 AM", () => {
    expect(formatClockLabel(0)).toBe("12:00 AM");
  });

  it("formats noon as 12:00 PM", () => {
    expect(formatClockLabel(12)).toBe("12:00 PM");
  });

  it("wraps hours past 24 back onto the clock", () => {
    expect(formatClockLabel(24.5)).toBe("12:30 AM");
  });

  it("formats an evening fractional hour", () => {
    expect(formatClockLabel(22.5)).toBe("10:30 PM");
  });
});
