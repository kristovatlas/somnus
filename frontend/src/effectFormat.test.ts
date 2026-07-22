/** Unit tests for the #17 effect-size formatting helpers. */

import { describe, expect, it } from "vitest";
import { contrastLine, effectHeadline } from "./effectFormat";
import type { BinnedContrast, EffectSize } from "./types";

function effect(
  value: number,
  overrides: Partial<EffectSize> = {},
): EffectSize {
  return {
    value,
    increment_label: "hour later",
    outcome_unit: "points",
    ...overrides,
  };
}

describe("effectHeadline", () => {
  it("returns null for a null effect", () => {
    expect(effectHeadline(null, "Sleep Score")).toBeNull();
  });

  it("suppresses magnitudes that would display as 0.0 (|value| < 0.05)", () => {
    expect(effectHeadline(effect(0.04), "Sleep Score")).toBeNull();
    expect(effectHeadline(effect(-0.04), "Sleep Score")).toBeNull();
    expect(effectHeadline(effect(0), "Sleep Score")).toBeNull();
  });

  it("renders magnitudes at or above the display floor", () => {
    expect(effectHeadline(effect(0.06), "Sleep Score")).toBe(
      "≈0.1 points higher Sleep Score per hour later",
    );
  });

  it("renders the compact no-outcome-label form", () => {
    expect(effectHeadline(effect(-2.3))).toBe(
      "≈2.3 points lower per hour later",
    );
  });

  it("uses direction from the sign and includes the outcome label", () => {
    expect(effectHeadline(effect(-2.34), "Deep Sleep")).toBe(
      "≈2.3 points lower Deep Sleep per hour later",
    );
  });
});

describe("contrastLine", () => {
  it("returns null for a null contrast", () => {
    expect(contrastLine(null)).toBeNull();
  });

  it("formats the median-split evidence line", () => {
    const contrast: BinnedContrast = {
      low_label: "11:34 PM or earlier",
      high_label: "after 11:34 PM",
      low_mean: 88,
      high_mean: 82,
      n_low: 20,
      n_high: 24,
    };
    expect(contrastLine(contrast)).toBe(
      "11:34 PM or earlier: avg 88 · after 11:34 PM: 82 (n=20/24)",
    );
  });

  it("renders minute-unit outcome averages as durations (#147)", () => {
    const contrast: BinnedContrast = {
      low_label: "12:10 AM or earlier",
      high_label: "after 12:10 AM",
      low_mean: 446.9,
      high_mean: 423.4,
      n_low: 182,
      n_high: 179,
    };
    expect(contrastLine(contrast, "total_sleep_minutes")).toBe(
      "12:10 AM or earlier: avg 7h 27m · after 12:10 AM: 7h 3m (n=182/179)",
    );
  });

  it("renders sub-hour durations without an hour part", () => {
    const contrast: BinnedContrast = {
      low_label: "≤ 100 mg",
      high_label: "> 100 mg",
      low_mean: 14.2,
      high_mean: 59.6,
      n_low: 10,
      n_high: 12,
    };
    // 59.6 rounds up to the hour boundary: "1h 0m", never "60m".
    expect(contrastLine(contrast, "onset_latency_minutes")).toBe(
      "≤ 100 mg: avg 14m · > 100 mg: 1h 0m (n=10/12)",
    );
  });

  it("leaves non-minute outcomes untouched", () => {
    const contrast: BinnedContrast = {
      low_label: "≤ 100 mg",
      high_label: "> 100 mg",
      low_mean: 88.4,
      high_mean: 82.1,
      n_low: 20,
      n_high: 24,
    };
    expect(contrastLine(contrast, "sleep_score")).toBe(
      "≤ 100 mg: avg 88.4 · > 100 mg: 82.1 (n=20/24)",
    );
    expect(contrastLine(contrast, "avg_hrv")).toBe(
      "≤ 100 mg: avg 88.4 · > 100 mg: 82.1 (n=20/24)",
    );
  });
});
