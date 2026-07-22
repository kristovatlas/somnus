import { describe, it, expect } from "vitest";
import { computeDecayCurve, mgAtHour } from "./caffeineCalc";

describe("computeDecayCurve", () => {
  it("returns 96 points (24h * 4 per hour)", () => {
    const points = computeDecayCurve([], "normal");
    expect(points).toHaveLength(96);
  });

  it("returns all zeros with no entries", () => {
    const points = computeDecayCurve([], "normal");
    expect(points.every((p) => p.mg === 0)).toBe(true);
  });

  it("starts at dose_mg at entry time", () => {
    const points = computeDecayCurve(
      [{ time: "08:00:00", amount_mg: 100 }],
      "normal",
    );
    const at8 = points.find((p) => p.hour === 8);
    expect(at8?.mg).toBe(100);
  });

  it("halves at half-life (normal = 4h)", () => {
    const points = computeDecayCurve(
      [{ time: "08:00:00", amount_mg: 100 }],
      "normal",
    );
    const at12 = points.find((p) => p.hour === 12);
    expect(at12?.mg).toBe(50);
  });

  it("fast metabolizer decays faster", () => {
    const fast = computeDecayCurve(
      [{ time: "08:00:00", amount_mg: 100 }],
      "fast",
    );
    const normal = computeDecayCurve(
      [{ time: "08:00:00", amount_mg: 100 }],
      "normal",
    );
    const fastAt12 = fast.find((p) => p.hour === 12)!.mg;
    const normalAt12 = normal.find((p) => p.hour === 12)!.mg;
    expect(fastAt12).toBeLessThan(normalAt12);
  });

  it("sums multiple entries", () => {
    const points = computeDecayCurve(
      [
        { time: "08:00:00", amount_mg: 100 },
        { time: "08:00:00", amount_mg: 50 },
      ],
      "normal",
    );
    const at8 = points.find((p) => p.hour === 8);
    expect(at8?.mg).toBe(150);
  });

  it("ignores entries without time", () => {
    const points = computeDecayCurve(
      [{ time: null, amount_mg: 100 }],
      "normal",
    );
    expect(points.every((p) => p.mg === 0)).toBe(true);
  });

  it("does not count caffeine before entry time", () => {
    const points = computeDecayCurve(
      [{ time: "12:00:00", amount_mg: 100 }],
      "normal",
    );
    const at8 = points.find((p) => p.hour === 8);
    expect(at8?.mg).toBe(0);
  });
});

describe("mgAtHour", () => {
  const points = computeDecayCurve(
    [{ time: "08:00:00", amount_mg: 100 }],
    "normal",
  );

  it("returns 0 for an empty curve", () => {
    expect(mgAtHour([], 12)).toBe(0);
  });

  it("returns the exact sample at a grid hour", () => {
    expect(mgAtHour(points, 12)).toBe(50);
  });

  it("interpolates between samples", () => {
    const at12 = points.find((p) => p.hour === 12)!.mg;
    const at1215 = points.find((p) => p.hour === 12.25)!.mg;
    const mid = mgAtHour(points, 12.125);
    expect(mid).toBeLessThan(at12);
    expect(mid).toBeGreaterThan(at1215);
    expect(mid).toBeCloseTo((at12 + at1215) / 2, 5);
  });

  it("clamps below the first sample", () => {
    expect(mgAtHour(points, -1)).toBe(points[0].mg);
  });

  it("clamps beyond the last sample", () => {
    expect(mgAtHour(points, 24)).toBe(points[points.length - 1].mg);
  });
});
