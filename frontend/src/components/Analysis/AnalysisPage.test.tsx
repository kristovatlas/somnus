import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AnalysisPage } from "./AnalysisPage";
import type {
  AnalysisStatus,
  CorrelationResponse,
  RegressionResponse,
  SleepTimingData,
  NapData,
} from "../../types";

// --- Mock data ---

const emptyStatus: AnalysisStatus = {
  total_sleep_days: 0,
  phase_a_unlocked: false,
  phase_b_unlocked: false,
  phase_c_unlocked: false,
  variables: [],
};

const phaseAStatus: AnalysisStatus = {
  total_sleep_days: 20,
  phase_a_unlocked: true,
  phase_b_unlocked: false,
  phase_c_unlocked: false,
  variables: [
    {
      name: "total_caffeine_mg",
      label: "Total Caffeine (mg)",
      n_days: 20,
      has_correlations: true,
      has_regression: false,
    },
    {
      name: "sleep_score",
      label: "Sleep Score",
      n_days: 20,
      has_correlations: true,
      has_regression: false,
    },
  ],
};

const fullStatus: AnalysisStatus = {
  total_sleep_days: 60,
  phase_a_unlocked: true,
  phase_b_unlocked: true,
  phase_c_unlocked: true,
  variables: [
    {
      name: "total_caffeine_mg",
      label: "Total Caffeine (mg)",
      n_days: 60,
      has_correlations: true,
      has_regression: true,
    },
    {
      name: "sleep_score",
      label: "Sleep Score",
      n_days: 60,
      has_correlations: true,
      has_regression: true,
    },
  ],
};

const correlations: CorrelationResponse = {
  results: [
    {
      predictor: "total_caffeine_mg",
      predictor_label: "Total Caffeine (mg)",
      outcome: "sleep_score",
      outcome_label: "Sleep Score",
      pearson_r: -0.65,
      spearman_r: -0.6,
      p_value: 0.001,
      n_days: 20,
      confidence: "low",
    },
  ],
  total_days: 20,
  excluded_sick_days: 2,
};

const regression: RegressionResponse = {
  results: [
    {
      outcome: "sleep_score",
      outcome_label: "Sleep Score",
      n_days: 60,
      r_squared: 0.35,
      adj_r_squared: 0.3,
      coefficients: [
        {
          predictor: "total_caffeine_mg",
          predictor_label: "Total Caffeine (mg)",
          coefficient: -0.42,
          ci_lower: -0.65,
          ci_upper: -0.19,
          p_value: 0.001,
          is_significant: true,
          vif: 1.2,
        },
      ],
      has_autocorrelation: false,
      is_stationary: true,
      multicollinearity_warning: false,
      excluded_predictors: [],
    },
  ],
  total_days: 60,
};

const timing: SleepTimingData = {
  chronotype: "intermediate",
  chronotype_confidence: "moderate",
  sleep_midpoint_avg_hour: 27.0,
  social_jet_lag_minutes: 45,
  social_jet_lag_rating: "moderate",
  optimal_bedtime_start: 22.0,
  optimal_bedtime_end: 23.0,
  n_days: 60,
};

const naps: NapData = {
  no_nap_baseline: {
    avg_onset_latency: 10,
    avg_efficiency: 0.9,
    avg_total_sleep: 420,
  },
  segments: [
    {
      timing_label: "1-3 PM",
      duration_label: "20-30 min",
      n_days: 8,
      avg_onset_latency: 12,
      avg_efficiency: 0.88,
      avg_total_sleep: 410,
      vs_no_nap_onset: 2.0,
    },
  ],
  total_nap_days: 8,
  total_no_nap_days: 20,
};

// --- Helpers ---

function mockFetch(responses: Record<string, unknown>) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    for (const [path, data] of Object.entries(responses)) {
      if (url.includes(path)) {
        return new Response(JSON.stringify(data));
      }
    }
    return new Response(JSON.stringify({}), { status: 404 });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/analysis"]}>
      <AnalysisPage />
    </MemoryRouter>,
  );
}

// --- Tests ---

describe("AnalysisPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Loading analysis...")).toBeInTheDocument();
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

  it("shows empty state with no data", async () => {
    mockFetch({
      "/api/analysis/status": emptyStatus,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("analysis-page")).toBeInTheDocument();
    });
    expect(screen.getByTestId("data-status")).toBeInTheDocument();
    expect(screen.getByText("0 sleep days recorded")).toBeInTheDocument();
  });

  it("shows gated correlation message when phase A locked", async () => {
    mockFetch({
      "/api/analysis/status": emptyStatus,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Log at least 14 days/)).toBeInTheDocument();
    });
  });

  it("shows correlation content when phase A unlocked", async () => {
    mockFetch({
      "/api/analysis/status": phaseAStatus,
      "/api/analysis/correlations": correlations,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("correlation-list")).toBeInTheDocument();
    });
    expect(screen.getByText("r = -0.65")).toBeInTheDocument();
  });

  it("shows regression gated message when phase B locked", async () => {
    mockFetch({
      "/api/analysis/status": phaseAStatus,
      "/api/analysis/correlations": correlations,
    });
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/Log 50\+ days to unlock regression/),
      ).toBeInTheDocument();
    });
  });

  it("shows regression when phase B unlocked", async () => {
    mockFetch({
      "/api/analysis/status": fullStatus,
      "/api/analysis/correlations": correlations,
      "/api/analysis/regression": regression,
      "/api/analysis/timing": timing,
      "/api/analysis/naps": naps,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("regression-summary")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/R² = 0.350/).length).toBeGreaterThan(0);
  });

  it("shows coefficient chart for regression results", async () => {
    mockFetch({
      "/api/analysis/status": fullStatus,
      "/api/analysis/correlations": correlations,
      "/api/analysis/regression": regression,
      "/api/analysis/timing": timing,
      "/api/analysis/naps": naps,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("coefficient-chart")).toBeInTheDocument();
    });
  });

  it("shows timing view when phase C unlocked", async () => {
    mockFetch({
      "/api/analysis/status": fullStatus,
      "/api/analysis/correlations": correlations,
      "/api/analysis/regression": regression,
      "/api/analysis/timing": timing,
      "/api/analysis/naps": naps,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("timing-view")).toBeInTheDocument();
    });
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
  });

  it("shows nap impact view when phase C unlocked", async () => {
    mockFetch({
      "/api/analysis/status": fullStatus,
      "/api/analysis/correlations": correlations,
      "/api/analysis/regression": regression,
      "/api/analysis/timing": timing,
      "/api/analysis/naps": naps,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("nap-impact")).toBeInTheDocument();
    });
    expect(screen.getByText("1-3 PM")).toBeInTheDocument();
  });

  it("explainer is accessible and toggles", async () => {
    mockFetch({
      "/api/analysis/status": emptyStatus,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("analysis-explainer")).toBeInTheDocument();
    });

    const toggle = screen.getByText("How to read these results");
    await userEvent.click(toggle);
    expect(screen.getByText(/measures how two variables/)).toBeInTheDocument();
  });

  it('uses hedged language - no "causes" or "improves"', async () => {
    mockFetch({
      "/api/analysis/status": fullStatus,
      "/api/analysis/correlations": correlations,
      "/api/analysis/regression": regression,
      "/api/analysis/timing": timing,
      "/api/analysis/naps": naps,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("analysis-page")).toBeInTheDocument();
    });

    // Check that no causal language appears in the rendered text
    const pageText = screen.getByTestId("analysis-page").textContent ?? "";
    expect(pageText).not.toMatch(/\bcauses?\b/i);
    expect(pageText).not.toMatch(/\bimproves?\b/i);
    expect(pageText).not.toMatch(/\bleads? to\b/i);
  });

  it("shows data status variable counts", async () => {
    mockFetch({
      "/api/analysis/status": phaseAStatus,
      "/api/analysis/correlations": correlations,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("data-status")).toBeInTheDocument();
    });
    expect(screen.getByText("20 sleep days recorded")).toBeInTheDocument();
  });

  it("shows sick day exclusion count", async () => {
    mockFetch({
      "/api/analysis/status": phaseAStatus,
      "/api/analysis/correlations": correlations,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/2 sick days excluded/)).toBeInTheDocument();
    });
  });
});
