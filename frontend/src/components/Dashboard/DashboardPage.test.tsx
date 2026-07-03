import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "./DashboardPage";
import type { DashboardData } from "../../types";

const fullDashboard: DashboardData = {
  sleep_record: {
    date: "2025-06-21",
    total_sleep_minutes: 420,
    rem_minutes: 100,
    deep_minutes: 80,
    light_minutes: 240,
    rem_pct: 23.8,
    deep_pct: 19.0,
    light_pct: 57.1,
    sleep_efficiency: 0.92,
    onset_latency_minutes: 8,
    avg_hrv: 45,
    lowest_hr: 52,
    avg_hr: 58.5,
    avg_breath_rate: 14.2,
    readiness_score: 82,
    sleep_score: 87,
    bedtime: "2025-06-20T22:30:00",
    wake_time: "2025-06-21T06:30:00",
  },
  stage_targets: {
    age_group: "18-30",
    deep_min_minutes: 75,
    deep_max_minutes: 100,
    rem_min_minutes: 90,
    rem_max_minutes: 120,
  },
  trends: [
    {
      date: "2025-06-19",
      sleep_score: 80,
      avg_hrv: 40,
      deep_minutes: 70,
      rem_minutes: 90,
    },
    {
      date: "2025-06-20",
      sleep_score: 85,
      avg_hrv: 42,
      deep_minutes: 75,
      rem_minutes: 95,
    },
    {
      date: "2025-06-21",
      sleep_score: 87,
      avg_hrv: 45,
      deep_minutes: 80,
      rem_minutes: 100,
    },
  ],
  stage_averages: {
    avg_deep_minutes: 75,
    avg_rem_minutes: 95,
    avg_light_minutes: 230,
    avg_total_minutes: 400,
    deep_vs_target: "in_range",
    rem_vs_target: "in_range",
    days_counted: 3,
  },
  consistency: {
    sigma_minutes: 22,
    sigma_rating: "consistent",
    delta_minutes: 15,
    delta_rating: "on_target",
    weekend_drift_minutes: 25,
    drift_rating: "minimal",
    bedtime_dots: [
      { date: "2025-06-19", bedtime_hour: 22.5, is_weekend: false },
      { date: "2025-06-20", bedtime_hour: 22.25, is_weekend: false },
      { date: "2025-06-21", bedtime_hour: 23.0, is_weekend: true },
    ],
    days_counted: 3,
  },
  logging_streak: 5,
  red_light_summary: {
    session_count: 4,
    total_dose_joules_cm2: 12.5,
    days_with_sessions: 3,
    meets_minimum: true,
  },
  today_caffeine_entries: [],
  caffeine_sensitivity: "normal",
  typical_bedtime: "22:30:00",
  top_recommendations: [],
};

const emptyDashboard: DashboardData = {
  sleep_record: null,
  stage_targets: null,
  trends: [],
  stage_averages: null,
  consistency: null,
  logging_streak: 0,
  red_light_summary: {
    session_count: 0,
    total_dose_joules_cm2: 0,
    days_with_sessions: 0,
    meets_minimum: false,
  },
  today_caffeine_entries: [],
  caffeine_sensitivity: "normal",
  typical_bedtime: null,
  top_recommendations: [],
};

function mockFetchWith(data: DashboardData) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    return new Response(JSON.stringify(data));
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Loading dashboard...")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(JSON.stringify({ detail: "Server error" }), {
        status: 500,
      });
    });
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/Server error|Failed to load/),
      ).toBeInTheDocument();
    });
  });

  it("renders all cards with full data", async () => {
    mockFetchWith(fullDashboard);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    });
    expect(screen.getByTestId("sleep-score-card")).toBeInTheDocument();
    expect(screen.getByTestId("stage-breakdown")).toBeInTheDocument();
    expect(screen.getByTestId("trend-sparklines")).toBeInTheDocument();
    expect(screen.getByTestId("consistency-meter")).toBeInTheDocument();
    expect(screen.getByTestId("logging-streak")).toBeInTheDocument();
    expect(screen.getByTestId("red-light-summary")).toBeInTheDocument();
  });

  it("shows score number in sleep card", async () => {
    mockFetchWith(fullDashboard);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("87")).toBeInTheDocument();
    });
  });

  it("shows no Oura data message when record is null", async () => {
    mockFetchWith(emptyDashboard);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/sync your Oura Ring/i)).toBeInTheDocument();
    });
  });

  it("shows no age message when targets are null", async () => {
    mockFetchWith({ ...fullDashboard, stage_targets: null });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Set your age in Settings/)).toBeInTheDocument();
    });
  });

  it("shows streak count", async () => {
    mockFetchWith(fullDashboard);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("logging-streak")).toBeInTheDocument();
    });
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows red light on track badge", async () => {
    mockFetchWith(fullDashboard);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("On track")).toBeInTheDocument();
    });
  });

  it("shows sessions recommended when not meeting minimum", async () => {
    mockFetchWith({
      ...fullDashboard,
      red_light_summary: {
        ...fullDashboard.red_light_summary,
        session_count: 1,
        meets_minimum: false,
      },
    });
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/2 more sessions recommended/),
      ).toBeInTheDocument();
    });
  });

  it("does not show caffeine chart when no entries", async () => {
    mockFetchWith(fullDashboard);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    });
    expect(screen.queryByText("Caffeine Decay")).not.toBeInTheDocument();
  });

  it("shows empty consistency message", async () => {
    mockFetchWith(emptyDashboard);
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/Need more data for consistency/),
      ).toBeInTheDocument();
    });
  });

  it("shows no trend data message", async () => {
    mockFetchWith(emptyDashboard);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No trend data yet/)).toBeInTheDocument();
    });
  });
});
