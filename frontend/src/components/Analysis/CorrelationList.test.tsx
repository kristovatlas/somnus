/** CorrelationList: #17 slope headline + binned-contrast evidence lead the
 * row; r is demoted to the stats line but still shown. */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CorrelationList } from "./CorrelationList";
import type { CorrelationResult } from "../../types";

const baseResult: CorrelationResult = {
  predictor: "bedtime_hour",
  predictor_label: "Bedtime (hour)",
  outcome: "sleep_score",
  outcome_label: "Sleep Score",
  pearson_r: -0.62,
  spearman_r: -0.58,
  p_value: 0.001,
  n_days: 44,
  confidence: "moderate",
  effect: {
    value: -2.3,
    increment_label: "hour later",
    outcome_unit: "points",
  },
  contrast: {
    low_label: "11:34 PM or earlier",
    high_label: "after 11:34 PM",
    low_mean: 88,
    high_mean: 82,
    n_low: 20,
    n_high: 24,
  },
};

describe("CorrelationList", () => {
  it("shows an empty state with no results", () => {
    render(<CorrelationList results={[]} excludedSickDays={0} />);
    expect(
      screen.getByText("Not enough data for correlations yet."),
    ).toBeInTheDocument();
  });

  it("renders the effect headline and contrast evidence lines", () => {
    render(<CorrelationList results={[baseResult]} excludedSickDays={0} />);
    expect(
      screen.getByText("≈2.3 points lower Sleep Score per hour later"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "11:34 PM or earlier: avg 88 · after 11:34 PM: 82 (n=20/24)",
      ),
    ).toBeInTheDocument();
  });

  it("demotes r to the stats row but still shows it", () => {
    render(<CorrelationList results={[baseResult]} excludedSickDays={0} />);
    expect(screen.getByText("r = -0.62")).toBeInTheDocument();
    expect(screen.getByText("n=44")).toBeInTheDocument();
  });

  it("omits headline and evidence when effect and contrast are null", () => {
    const bare: CorrelationResult = {
      ...baseResult,
      predictor: "last_caffeine_hour",
      predictor_label: "Last Caffeine (hour)",
      effect: null,
      contrast: null,
    };
    const { container } = render(
      <CorrelationList results={[bare]} excludedSickDays={0} />,
    );
    expect(container.querySelector(".correlation-headline")).toBeNull();
    expect(container.querySelector(".correlation-evidence")).toBeNull();
    expect(screen.getByText("r = -0.62")).toBeInTheDocument();
  });
});
