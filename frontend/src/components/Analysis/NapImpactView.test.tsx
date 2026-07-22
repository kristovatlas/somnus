// #104: the no-nap baseline must pluralize correctly and spell out its
// metrics ("onset 12 min / eff 90%" read as jargon in dogfood).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NapImpactView } from "./NapImpactView";
import type { NapData } from "../../types";

function napData(overrides: Partial<NapData>): NapData {
  return {
    no_nap_baseline: { avg_onset_latency: 12, avg_efficiency: 0.9 },
    segments: [],
    total_nap_days: 3,
    total_no_nap_days: 1,
    ...overrides,
  };
}

describe("NapImpactView baseline copy (#104)", () => {
  it("pluralizes: 1 day, not 1 days", () => {
    render(<NapImpactView data={napData({ total_no_nap_days: 1 })} />);
    expect(screen.getByText(/No-nap baseline \(1 day\)/)).toBeInTheDocument();
    expect(screen.queryByText(/1 days/)).toBeNull();
  });

  it("spells out the metrics instead of onset/eff shorthand", () => {
    render(<NapImpactView data={napData({ total_no_nap_days: 5 })} />);
    expect(screen.getByText(/No-nap baseline \(5 days\)/)).toBeInTheDocument();
    expect(screen.getByText(/fell asleep in\s*12 min/)).toBeInTheDocument();
    expect(screen.getByText(/90% sleep\s*efficiency/)).toBeInTheDocument();
  });
});
