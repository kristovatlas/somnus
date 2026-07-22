// #104: near-zero r values must render one canonical "0.0" (never a
// meaningless "-0.0"/"+0.0" split), and row labels must not be truncated.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CorrelationHeatmap } from "./CorrelationHeatmap";
import type { CorrelationResult } from "../../types";

function result(overrides: Partial<CorrelationResult>): CorrelationResult {
  return {
    predictor: "caffeine_mg",
    predictor_label: "Caffeine (mg)",
    outcome: "sleep_score",
    outcome_label: "Sleep Score",
    pearson_r: 0.2,
    spearman_r: 0.2,
    p_value: 0.03,
    n_days: 30,
    confidence: "moderate",
    effect: null,
    contrast: null,
    ...overrides,
  };
}

describe("CorrelationHeatmap formatting (#104)", () => {
  it("folds negative zero — ±0.04 both render as 0.0", () => {
    render(
      <CorrelationHeatmap
        results={[
          result({ predictor: "a", predictor_label: "A", pearson_r: -0.04 }),
          result({ predictor: "b", predictor_label: "B", pearson_r: 0.04 }),
        ]}
      />,
    );
    const zeros = screen.getAllByText("0.0");
    expect(zeros).toHaveLength(2);
    expect(screen.queryByText("-0.0")).toBeNull();
    expect(screen.queryByText("+0.0")).toBeNull();
  });

  it("keeps the sign for genuinely nonzero values", () => {
    render(
      <CorrelationHeatmap
        results={[
          result({ predictor: "a", predictor_label: "A", pearson_r: -0.32 }),
          result({ predictor: "b", predictor_label: "B", pearson_r: 0.28 }),
        ]}
      />,
    );
    expect(screen.getByText("-0.3")).toBeInTheDocument();
    expect(screen.getByText("+0.3")).toBeInTheDocument();
  });

  it("renders long row labels in full instead of truncating", () => {
    render(
      <CorrelationHeatmap
        results={[
          result({
            predictor: "bedtime_std_7d",
            predictor_label: "Bedtime Variability (7d)",
          }),
        ]}
      />,
    );
    expect(screen.getAllByText("Bedtime Variability (7d)")).not.toHaveLength(0);
    expect(screen.queryByText(/Bedtime Variabilit\.\.\./)).toBeNull();
  });
});
