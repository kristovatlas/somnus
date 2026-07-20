// #102: "86.8 → 85.6" read as a drop — the prior value must be labeled
// so the row reads "this week 86.8, prev 85.6, flat".
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricsComparisonCard } from "./MetricsComparisonCard";
import type { MetricAverages, TrendArrows } from "../../types";

const CURRENT: MetricAverages = {
  avg_sleep_score: 86.8,
  avg_hrv: 45,
  avg_deep_minutes: 70,
  avg_rem_minutes: 90,
};
const PRIOR: MetricAverages = {
  avg_sleep_score: 85.6,
  avg_hrv: 44,
  avg_deep_minutes: 68,
  avg_rem_minutes: 88,
};
const TRENDS: TrendArrows = {
  sleep_score: "flat",
  avg_hrv: "flat",
  deep_minutes: "flat",
  rem_minutes: "flat",
};

describe("MetricsComparisonCard prior labeling (#102)", () => {
  it("labels the prior-period value instead of a bare number", () => {
    render(
      <MetricsComparisonCard current={CURRENT} prior={PRIOR} trends={TRENDS} />,
    );
    expect(screen.getByText("86.8")).toBeInTheDocument();
    expect(screen.getByText(/prev 85\.6/)).toBeInTheDocument();
  });

  it("shows an em-dash prev when the prior period has no data", () => {
    render(
      <MetricsComparisonCard
        current={CURRENT}
        prior={{
          avg_sleep_score: null,
          avg_hrv: null,
          avg_deep_minutes: null,
          avg_rem_minutes: null,
        }}
        trends={{
          sleep_score: null,
          avg_hrv: null,
          deep_minutes: null,
          rem_minutes: null,
        }}
      />,
    );
    expect(screen.getAllByText(/prev —/).length).toBeGreaterThan(0);
  });
});
