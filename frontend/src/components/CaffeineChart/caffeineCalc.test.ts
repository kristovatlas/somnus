import { describe, it, expect } from "vitest";
import { computeDecayCurve } from "./caffeineCalc";

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
