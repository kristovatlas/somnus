// #102: the card must say its numbers are all-time (identical values
// week-to-week confused dogfooding) and list up to 3 factors per direction.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopFactorsCard } from "./TopFactorsCard";

const POS = [
  { label: "Morning Sunlight (min)", pearson_r: 0.42, n_days: 40 },
  { label: "Exercise (min)", pearson_r: 0.31, n_days: 35 },
];
const NEG = [{ label: "Bedtime (hour)", pearson_r: -0.32, n_days: 44 }];

describe("TopFactorsCard (#102)", () => {
  it("lists factors with r and n, plus the all-time caption", () => {
    render(<TopFactorsCard positive={POS} negative={NEG} totalDays={45} />);
    expect(screen.getByText("Morning Sunlight (min)")).toBeInTheDocument();
    expect(screen.getByText("Exercise (min)")).toBeInTheDocument();
    expect(screen.getByText(/r=-0\.32, n=44/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Computed across all 45 days .* not specific to this week/,
      ),
    ).toBeInTheDocument();
  });

  it("renders nothing when both directions are empty", () => {
    const { container } = render(
      <TopFactorsCard positive={[]} negative={[]} totalDays={45} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
