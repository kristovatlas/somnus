import { describe, it, expect } from "vitest";
import {
  computeDecayCurve,
  curveEndHour,
  mgAtHour,
  wrapBedtimeHour,
} from "./caffeineCalc";

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

  it("extends past 24h when endHour is given", () => {
    const points = computeDecayCurve(
      [{ time: "14:00:00", amount_mg: 200 }],
      "normal",
      25,
    );
    expect(points).toHaveLength(100); // 25h * 4 per hour
    expect(points[points.length - 1].hour).toBe(24.75);
    // 10.5h after the 14:00 dose: 200 * 0.5^(10.5/4) = 32.42 -> 32.4.
    const at2430 = points.find((p) => p.hour === 24.5);
    expect(at2430?.mg).toBe(32.4);
  });
});

describe("wrapBedtimeHour", () => {
  it("wraps hours before the 6 AM cutoff onto the evening scale", () => {
    expect(wrapBedtimeHour(0.5)).toBe(24.5); // 00:30 -> 24.5
    expect(wrapBedtimeHour(0)).toBe(24);
    expect(wrapBedtimeHour(5.75)).toBe(29.75);
  });

  it("leaves daytime and evening hours unchanged", () => {
    expect(wrapBedtimeHour(6)).toBe(6);
    expect(wrapBedtimeHour(22.5)).toBe(22.5);
  });
});

describe("curveEndHour", () => {
  it("defaults to 24 without a bedtime", () => {
    expect(curveEndHour(null)).toBe(24);
    expect(curveEndHour(undefined)).toBe(24);
  });

  it("stays at 24 for evening bedtimes", () => {
    expect(curveEndHour(22)).toBe(24);
    expect(curveEndHour(23.5)).toBe(24);
  });

  it("extends just past a wrapped after-midnight bedtime", () => {
    expect(curveEndHour(0.5)).toBe(25); // 00:30 -> 24.5 + 0.5
    expect(curveEndHour(2)).toBe(26.5);
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
