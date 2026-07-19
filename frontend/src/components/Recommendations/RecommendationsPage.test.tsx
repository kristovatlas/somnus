import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { RecommendationsPage } from "./RecommendationsPage";
import type { RecommendationsResponse } from "../../types";

// --- Mock data ---

const insufficientData: RecommendationsResponse = {
  recommendations: [],
  total_days: 20,
  has_sufficient_data: false,
  active_experiment: null,
};

const fullData: RecommendationsResponse = {
  recommendations: [
    {
      id: "data_driven:total_caffeine_mg:sleep_score",
      category: "data_driven",
      priority: 2,
      title: "Total Caffeine (mg)",
      body: "Reducing total caffeine may be associated with better Sleep Score (n=60 days, p=0.003).",
      factor: "total_caffeine_mg",
      factor_label: "Total Caffeine (mg)",
      outcome: "sleep_score",
      outcome_label: "Sleep Score",
      evidence_level: "high",
      suggested_experiment:
        "Try limiting caffeine to under 400 mg/day for 2 weeks",
      n_days: 60,
    },
    {
      id: "science_threshold:last_caffeine_hour",
      category: "science_threshold",
      priority: 15,
      title: "Consider an earlier caffeine cutoff",
      body: "Your average last caffeine intake is around 16:00, which is after the commonly recommended 2 PM cutoff.",
      factor: "last_caffeine_hour",
      factor_label: "Last Caffeine Time",
      outcome: null,
      outcome_label: null,
      evidence_level: "very_high",
      suggested_experiment: "Try cutting off caffeine before 2 PM for 2 weeks",
      n_days: 14,
    },
    {
      id: "untried:red_light_done",
      category: "untried",
      priority: 27,
      title: "Try red light therapy",
      body: "Red/near-infrared light therapy may support melatonin production.",
      factor: "red_light_done",
      factor_label: "Red Light Therapy",
      outcome: null,
      outcome_label: null,
      evidence_level: "moderate",
      suggested_experiment: "Try red light therapy sessions for 2 weeks",
      n_days: null,
    },
  ],
  total_days: 60,
  has_sufficient_data: true,
  active_experiment: null,
};

const dataWithExperiment: RecommendationsResponse = {
  ...fullData,
  active_experiment: {
    id: 1,
    factor: "total_caffeine_mg",
    factor_label: "Total Caffeine (mg)",
    hypothesis: "Reducing caffeine will improve sleep score",
    start_date: "2025-03-01",
    end_date: "2025-03-14",
    status: "active",
    notes: null,
    baseline_sleep_score: 75,
    baseline_deep_minutes: 65,
    baseline_rem_minutes: 85,
    baseline_hrv: 42,
    result_sleep_score: 82,
    result_deep_minutes: 72,
    result_rem_minutes: 92,
    result_hrv: 48,
    days_completed: 7,
  },
};

// --- Helpers ---

function mockFetch(data: RecommendationsResponse) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    return new Response(JSON.stringify(data));
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/recommendations"]}>
      <RecommendationsPage />
    </MemoryRouter>,
  );
}

// --- Tests ---

describe("RecommendationsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Loading recommendations...")).toBeInTheDocument();
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

  it("shows gated state when insufficient data", async () => {
    mockFetch(insufficientData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("recommendations-page")).toBeInTheDocument();
    });
    expect(screen.getByText("20 days")).toBeInTheDocument();
    expect(screen.getByText(/Log 50\+ days/)).toBeInTheDocument();
  });

  it("renders recommendation cards when data sufficient", async () => {
    mockFetch(fullData);
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTestId("recommendation-card")).toHaveLength(3);
    });
  });

  it("shows experiment tracker when active experiment", async () => {
    mockFetch(dataWithExperiment);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("experiment-tracker")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Reducing caffeine will improve sleep score"),
    ).toBeInTheDocument();
    expect(screen.getByText("7 / 14 days")).toBeInTheDocument();
  });

  it("hides start experiment buttons when experiment active", async () => {
    mockFetch(dataWithExperiment);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("experiment-tracker")).toBeInTheDocument();
    });
    expect(screen.queryAllByText("Start experiment")).toHaveLength(0);
  });

  it("shows start experiment buttons when no active experiment", async () => {
    mockFetch(fullData);
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("Start experiment")).toHaveLength(3);
    });
  });

  it("uses hedged language - no causal words", async () => {
    mockFetch(fullData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("recommendations-page")).toBeInTheDocument();
    });
    const pageText =
      screen.getByTestId("recommendations-page").textContent ?? "";
    expect(pageText).not.toMatch(/\bcauses?\b/i);
    expect(pageText).not.toMatch(/\bimproves?\b/i);
    expect(pageText).not.toMatch(/\bleads? to\b/i);
  });

  it("explainer toggles on click", async () => {
    mockFetch(fullData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("How recommendations work")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("How recommendations work"));
    expect(screen.getByText(/statistical associations/)).toBeInTheDocument();
  });

  it("renders metric pills in experiment tracker", async () => {
    mockFetch(dataWithExperiment);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("experiment-tracker")).toBeInTheDocument();
    });
    // Check baseline → result format
    expect(screen.getByText("75 → 82")).toBeInTheDocument();
    expect(screen.getByText("65 → 72")).toBeInTheDocument();
  });

  it("TopRecommendations links to full page", async () => {
    // This tests the TopRecommendations component behavior
    const { TopRecommendations } =
      await import("../Dashboard/TopRecommendations");

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <TopRecommendations
          recommendations={[
            { id: "test", title: "Test rec", category: "data_driven" },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("top-recommendations")).toBeInTheDocument();
    expect(screen.getByText("Test rec")).toBeInTheDocument();
    expect(screen.getByText(/View all/)).toBeInTheDocument();
  });

  it("TopRecommendations hidden when empty", async () => {
    const { TopRecommendations } =
      await import("../Dashboard/TopRecommendations");

    const { container } = render(
      <MemoryRouter>
        <TopRecommendations recommendations={[]} />
      </MemoryRouter>,
    );

    expect(container.innerHTML).toBe("");
  });
});
