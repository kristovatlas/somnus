import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ReportsPage } from "./ReportsPage";
import type { WeeklyReport, MonthlyReport } from "../../types";

const weeklyData: WeeklyReport = {
  period_start: "2026-02-16",
  period_end: "2026-02-22",
  iso_year: 2026,
  iso_week: 8,
  days_with_data: 5,
  days_in_period: 7,
  logging_completeness: "5/7 days",
  current: {
    avg_sleep_score: 84.2,
    avg_hrv: 43.5,
    avg_deep_minutes: 68.0,
    avg_rem_minutes: 88.0,
  },
  prior: {
    avg_sleep_score: 80.0,
    avg_hrv: 40.0,
    avg_deep_minutes: 65.0,
    avg_rem_minutes: 85.0,
  },
  trends: {
    sleep_score: "up",
    avg_hrv: "up",
    deep_minutes: "up",
    rem_minutes: "flat",
  },
  consistency: {
    sigma_minutes: 22,
    sigma_rating: "consistent",
    delta_minutes: 15,
    delta_rating: "on_target",
    weekend_drift_minutes: 25,
    drift_rating: "minimal",
    bedtime_dots: [],
    days_counted: 5,
  },
  top_positive_factors: [
    {
      label: "Morning Sunlight (min)",
      pearson_r: 0.45,
      n_days: 40,
      effect: null,
    },
  ],
  top_negative_factors: [
    {
      label: "Total Caffeine (mg)",
      pearson_r: -0.32,
      n_days: 38,
      effect: null,
    },
  ],
  factors_total_days: 45,
  has_insufficient_data: false,
};

const monthlyData: MonthlyReport = {
  period_start: "2026-02-01",
  period_end: "2026-02-28",
  year: 2026,
  month: 2,
  month_name: "February",
  days_with_data: 15,
  days_in_period: 28,
  logging_completeness: "15/28 days",
  current: {
    avg_sleep_score: 82.0,
    avg_hrv: 42.0,
    avg_deep_minutes: 66.0,
    avg_rem_minutes: 87.0,
  },
  prior: {
    avg_sleep_score: 78.0,
    avg_hrv: 38.0,
    avg_deep_minutes: 62.0,
    avg_rem_minutes: 84.0,
  },
  trends: {
    sleep_score: "up",
    avg_hrv: "up",
    deep_minutes: "up",
    rem_minutes: "flat",
  },
  best_night: {
    date: "2026-02-10",
    sleep_score: 95,
    contributing_factors: ["Exercised", "No alcohol"],
  },
  worst_night: {
    date: "2026-02-05",
    sleep_score: 62,
    contributing_factors: ["Alcohol"],
  },
  stage_compliance: {
    deep_target_nights: 10,
    deep_total_nights: 15,
    rem_target_nights: 12,
    rem_total_nights: 15,
  },
  active_experiment: null,
  weekly_summaries: [],
  has_insufficient_data: false,
};

const insufficientWeekly: WeeklyReport = {
  ...weeklyData,
  days_with_data: 1,
  has_insufficient_data: true,
  consistency: null,
  top_positive_factors: [],
  top_negative_factors: [],
  factors_total_days: null,
};

function mockFetch(weekly: WeeklyReport, monthly: MonthlyReport) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    if (url.includes("/api/reports/monthly")) {
      return new Response(JSON.stringify(monthly));
    }
    return new Response(JSON.stringify(weekly));
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/reports"]}>
      <ReportsPage />
    </MemoryRouter>,
  );
}

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Loading weekly report...")).toBeInTheDocument();
  });

  it("shows week view by default", async () => {
    mockFetch(weeklyData, monthlyData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("weekly-report-view")).toBeInTheDocument();
    });
  });

  it("switches to month view on tab click", async () => {
    mockFetch(weeklyData, monthlyData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("weekly-report-view")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Monthly"));
    await waitFor(() => {
      expect(screen.getByTestId("monthly-report-view")).toBeInTheDocument();
    });
  });

  it("shows insufficient data message", async () => {
    mockFetch(insufficientWeekly, monthlyData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("insufficient-data")).toBeInTheDocument();
    });
  });

  it("shows metrics comparison card with trend arrows", async () => {
    mockFetch(weeklyData, monthlyData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("metrics-comparison")).toBeInTheDocument();
    });
    // Check that trend arrows are rendered (up arrow = \u2191)
    expect(screen.getAllByText("\u2191").length).toBeGreaterThan(0);
  });

  it("shows export link with correct href", async () => {
    mockFetch(weeklyData, monthlyData);
    renderPage();
    await waitFor(() => {
      const link = screen.getByText("Export as HTML");
      expect(link).toBeInTheDocument();
      expect(link.getAttribute("href")).toContain(
        "/api/reports/weekly/export-html",
      );
    });
  });

  it("shows best and worst night cards in monthly view", async () => {
    mockFetch(weeklyData, monthlyData);
    renderPage();
    fireEvent.click(screen.getByText("Monthly"));
    await waitFor(() => {
      expect(screen.getByTestId("best-worst-nights")).toBeInTheDocument();
    });
    expect(screen.getByText("Score: 95")).toBeInTheDocument();
    expect(screen.getByText("Score: 62")).toBeInTheDocument();
  });

  it("shows stage compliance in monthly view", async () => {
    mockFetch(weeklyData, monthlyData);
    renderPage();
    fireEvent.click(screen.getByText("Monthly"));
    await waitFor(() => {
      expect(screen.getByTestId("stage-compliance")).toBeInTheDocument();
    });
    expect(screen.getByText(/10\/15 nights/)).toBeInTheDocument();
  });

  it("hides stage compliance when null", async () => {
    const noCompliance = { ...monthlyData, stage_compliance: null };
    mockFetch(weeklyData, noCompliance);
    renderPage();
    fireEvent.click(screen.getByText("Monthly"));
    await waitFor(() => {
      expect(screen.getByTestId("monthly-report-view")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("stage-compliance")).not.toBeInTheDocument();
  });

  it("renders period navigation and updates label", async () => {
    mockFetch(weeklyData, monthlyData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText("Previous week")).toBeInTheDocument();
      expect(screen.getByLabelText("Next week")).toBeInTheDocument();
    });
  });
});
