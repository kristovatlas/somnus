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
});
