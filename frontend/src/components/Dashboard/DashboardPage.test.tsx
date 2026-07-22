import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "./DashboardPage";
import { addDays, todayStr } from "../../utils/date";
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
      expect(
        within(screen.getByTestId("sleep-score-card")).getByText("87"),
      ).toBeInTheDocument();
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
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
  });

  it("shows sessions remaining when not meeting minimum", async () => {
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
        screen.getByText(/2 more sessions to reach 3 in the last 7 days/),
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

  it("labels the sleep score with the night it describes (issue #14)", async () => {
    mockFetchWith(fullDashboard);
    renderPage();
    await waitFor(() => {
      // record date 2025-06-21 is in the past → explicit night label
      expect(screen.getByText(/Night ending Jun 21/)).toBeInTheDocument();
    });
  });

  it("says 'Last night' when the record is from today", async () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    mockFetchWith({
      ...fullDashboard,
      sleep_record: { ...fullDashboard.sleep_record!, date: iso },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Last night/)).toBeInTheDocument();
    });
  });

  it("does not claim 'Last night' for a future-dated record", async () => {
    // Reachable when the server's calendar day is ahead of the browser's
    // (e.g. UTC container, browser in a western timezone in the evening)
    mockFetchWith({
      ...fullDashboard,
      sleep_record: {
        ...fullDashboard.sleep_record!,
        date: addDays(todayStr(), 1),
      },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Night ending/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Last night/)).not.toBeInTheDocument();
  });

  it("explains missing metrics instead of bare dashes (issue #14)", async () => {
    mockFetchWith({
      ...fullDashboard,
      sleep_record: {
        ...fullDashboard.sleep_record!,
        avg_hrv: null,
        lowest_hr: null,
        sleep_efficiency: null,
      },
    });
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/Oura didn't return that metric/),
      ).toBeInTheDocument();
    });
  });

  it("hides the missing-metric note when all metrics present", async () => {
    mockFetchWith(fullDashboard);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("sleep-score-card")).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/Oura didn't return that metric/),
    ).not.toBeInTheDocument();
  });

  it("shows latest values and ranges next to sparklines (issue #14)", async () => {
    mockFetchWith(fullDashboard);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("trend-sparklines")).toBeInTheDocument();
    });
    const sparklines = within(screen.getByTestId("trend-sparklines"));
    // Latest HRV is 45ms; 7-day range 40–45ms
    expect(sparklines.getByText("45ms")).toBeInTheDocument();
    expect(sparklines.getByText(/7d range: 40–45ms/)).toBeInTheDocument();
    // Deep sleep latest 80m, range 70–80m
    expect(sparklines.getByText("80m")).toBeInTheDocument();
    expect(sparklines.getByText(/7d range: 70–80m/)).toBeInTheDocument();
  });

  it("shows a dash when the latest trend day is missing a metric", async () => {
    const trends = fullDashboard.trends.map((t, i, arr) =>
      i === arr.length - 1 ? { ...t, avg_hrv: null } : t,
    );
    mockFetchWith({ ...fullDashboard, trends });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("trend-sparklines")).toBeInTheDocument();
    });
    const sparklines = within(screen.getByTestId("trend-sparklines"));
    // Latest HRV is missing → placeholder, not yesterday's 42ms
    expect(sparklines.getByText("—")).toBeInTheDocument();
    expect(sparklines.queryByText("42ms")).not.toBeInTheDocument();
    // Range still computed from the recorded days
    expect(sparklines.getByText(/7d range: 40–42ms/)).toBeInTheDocument();
  });

  it("labels consistency pills with words, not greek letters (issues #14, #37)", async () => {
    mockFetchWith(fullDashboard);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("consistency-meter")).toBeInTheDocument();
    });
    // Word labels on the pills. Delta is an absolute offset (backend takes
    // mean of |bedtime - target|), so it must render unsigned — no
    // direction claim.
    expect(screen.getByText(/Variability \d+m/)).toBeInTheDocument();
    expect(screen.getByText(/Bedtime offset 15m/)).toBeInTheDocument();
    expect(screen.getByText(/Weekend drift \d+m/)).toBeInTheDocument();
    const meter = screen.getByTestId("consistency-meter");
    // No Greek anywhere on the card (issue #37)
    expect(meter.textContent).not.toMatch(/[σδΔ]/);
    // Hover tooltips dropped — the expander is the single explain mechanism
    expect(meter.querySelectorAll("[title]")).toHaveLength(0);
  });

  it("makes threshold guidance reachable without hover", async () => {
    // The disclosure carries the guidance for keyboard/touch users
    // (bedside tablet case) — no title tooltips exist anymore.
    const user = userEvent.setup();
    mockFetchWith(fullDashboard);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("consistency-meter")).toBeInTheDocument();
    });
    await user.click(screen.getByText(/what do these mean\?/i));
    expect(screen.getByText(/Under 30 min is consistent/)).toBeVisible();
    // Δ is |weekend − weekday| on the backend — no direction claim allowed
    expect(
      screen.getByText(/either direction \(social jet lag\)/),
    ).toBeVisible();
  });
});
