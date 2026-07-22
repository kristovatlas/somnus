// #113: best/worst night cards carry enough context to reconstruct
// "what was different about that night" — weekday, bedtime, duration,
// deep/REM/HRV — with unrecorded fields simply omitted.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BestWorstNightsCard } from "./BestWorstNightsCard";
import type { NightSummary } from "../../types";

const FULL_NIGHT: NightSummary = {
  date: "2026-02-10",
  sleep_score: 95,
  weekday: "Tuesday",
  bedtime: "11:42 PM",
  total_sleep_minutes: 458,
  deep_minutes: 71,
  rem_minutes: 96,
  avg_hrv: 44.4,
  contributing_factors: ["Exercised", "No alcohol"],
};

const SPARSE_NIGHT: NightSummary = {
  date: "2026-02-05",
  sleep_score: 62,
  weekday: "Thursday",
  bedtime: null,
  total_sleep_minutes: null,
  deep_minutes: null,
  rem_minutes: null,
  avg_hrv: null,
  contributing_factors: [],
};

describe("BestWorstNightsCard night context (#113)", () => {
  it("shows weekday, bedtime, duration, and stage/HRV metrics", () => {
    render(<BestWorstNightsCard best={FULL_NIGHT} worst={null} />);
    expect(
      screen.getByText(
        "Tue · bed 11:42 PM · 7h 38m · deep 71m · REM 96m · HRV 44",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("2026-02-10")).toBeInTheDocument();
    expect(screen.getByText("Score: 95")).toBeInTheDocument();
  });

  it("omits unrecorded fields instead of rendering null", () => {
    render(<BestWorstNightsCard best={null} worst={SPARSE_NIGHT} />);
    expect(screen.getByText("Thu")).toBeInTheDocument();
    expect(screen.getByText("Score: 62")).toBeInTheDocument();
    const card = screen.getByTestId("best-worst-nights");
    expect(card.textContent).not.toMatch(/null|NaN|undefined/);
    // "bed \d" (not bare "bed") so the sentinel can't trip on card copy
    // like "Best & Worst" or factor tags such as "Pre-bed ritual".
    expect(card.textContent).not.toMatch(/bed \d|deep|REM|HRV/);
  });

  it("renders no details line when a legacy payload has no context fields", () => {
    const legacy: NightSummary = {
      date: "2026-02-03",
      sleep_score: 80,
      contributing_factors: ["Alcohol"],
    };
    render(<BestWorstNightsCard best={legacy} worst={null} />);
    expect(screen.getByText("Score: 80")).toBeInTheDocument();
    expect(screen.getByText("Alcohol")).toBeInTheDocument();
    expect(
      screen.getByTestId("best-worst-nights").querySelector(".report-muted"),
    ).toBeNull();
  });
});
