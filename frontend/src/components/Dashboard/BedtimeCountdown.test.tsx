import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { BedtimeCountdown } from "./BedtimeCountdown";
import { computeBedtimeStatus } from "../../bedtime";

function at(h: number, m = 0): Date {
  return new Date(2026, 6, 16, h, m);
}

describe("computeBedtimeStatus", () => {
  it("counts down to a target bedtime later today", () => {
    const s = computeBedtimeStatus(22.5, null, "typical", at(20, 15));
    expect(s.label).toBe("Bedtime in 2h 15m");
    expect(s.detail).toBe("target bedtime 10:30 PM");
  });

  it("announces bedtime at the target minute", () => {
    expect(computeBedtimeStatus(22.5, null, "typical", at(22, 30)).label).toBe(
      "It's bedtime",
    );
  });

  it("reports past-bedtime inside the 3h grace window", () => {
    expect(computeBedtimeStatus(22.5, null, "typical", at(23, 45)).label).toBe(
      "Past bedtime by 1h 15m",
    );
  });

  it("rolls to tomorrow after the grace window (early morning)", () => {
    const s = computeBedtimeStatus(22.5, null, "typical", at(9, 0));
    expect(s.label).toBe("Bedtime in 13h 30m");
  });

  it("optimal window: open, past, and upcoming states wrap midnight", () => {
    const open = computeBedtimeStatus(22.75, 23.5, "optimal", at(23, 10));
    expect(open.label).toBe("You're in your optimal bedtime window");
    expect(open.detail).toBe("optimal window 10:45 PM–11:30 PM");

    expect(computeBedtimeStatus(23.5, 0.5, "optimal", at(0, 15)).label).toBe(
      "You're in your optimal bedtime window", // crosses midnight
    );
    expect(computeBedtimeStatus(22.75, 23.5, "optimal", at(1, 0)).label).toBe(
      "Past bedtime by 1h 30m",
    );
    expect(computeBedtimeStatus(22.75, 23.5, "optimal", at(12, 0)).label).toBe(
      "Bedtime in 10h 45m",
    );
  });
});

describe("BedtimeCountdown", () => {
  beforeEach(() => vi.restoreAllMocks());

  const timing = (start: number | null, end: number | null) => ({
    chronotype: null,
    chronotype_confidence: null,
    sleep_midpoint_avg_hour: null,
    social_jet_lag_minutes: null,
    social_jet_lag_rating: null,
    optimal_bedtime_start: start,
    optimal_bedtime_end: end,
    n_days: 60,
  });

  it("prefers the optimal window from the timing API", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify(timing(22.75, 23.5))),
    );
    render(<BedtimeCountdown typicalBedtime="21:00:00" />);
    expect(await screen.findByText(/optimal window/)).toBeInTheDocument();
  });

  it("falls back to the target bedtime when the engine has no window", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify(timing(null, null))),
    );
    render(<BedtimeCountdown typicalBedtime="21:00:00" />);
    expect(await screen.findByText(/target bedtime/)).toBeInTheDocument();
  });

  it("renders nothing with no window and no target bedtime", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify(timing(null, null))),
    );
    const { container } = render(<BedtimeCountdown typicalBedtime={null} />);
    await vi.waitFor(() => {
      expect(vi.mocked(globalThis.fetch).mock.calls.length).toBeGreaterThan(0);
    });
    expect(
      container.querySelector("[data-testid=bedtime-countdown]"),
    ).toBeNull();
  });

  it("timing API failure still falls back to the target bedtime", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new TypeError("down");
    });
    render(<BedtimeCountdown typicalBedtime="21:00:00" />);
    expect(await screen.findByText(/target bedtime/)).toBeInTheDocument();
  });
});
