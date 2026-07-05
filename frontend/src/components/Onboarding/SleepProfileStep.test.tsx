import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SleepProfileStep } from "./SleepProfileStep";
import { CaffeineSensitivity, type Chronotype } from "../../types/enums";

function renderStep(chronotype: Chronotype | null) {
  const onUpdate = vi.fn();
  render(
    <SleepProfileStep
      typicalBedtime={null}
      targetWakeTime={null}
      caffeineSensitivity={CaffeineSensitivity.NORMAL}
      chronotype={chronotype}
      onUpdate={onUpdate}
      onNext={vi.fn()}
      onBack={vi.fn()}
    />,
  );
  return onUpdate;
}

describe("SleepProfileStep", () => {
  it("defaults chronotype to 'Not sure — infer it from my data' (issue #10)", () => {
    renderStep(null);
    const select = screen.getByDisplayValue(/Not sure — infer it from my data/);
    expect(select).toBeInTheDocument();
  });

  it("explains why self-assessed chronotype can bias analysis", () => {
    renderStep(null);
    expect(
      screen.getByText(/often reflect habits rather than biology/),
    ).toBeInTheDocument();
  });

  it("selecting 'not sure' stores chronotype null", async () => {
    const user = userEvent.setup();
    const onUpdate = renderStep("late");
    await user.selectOptions(screen.getByDisplayValue("Night Owl"), "unknown");
    expect(onUpdate).toHaveBeenCalledWith({ chronotype: null });
  });

  it("selecting a concrete chronotype stores it", async () => {
    const user = userEvent.setup();
    const onUpdate = renderStep(null);
    await user.selectOptions(screen.getByDisplayValue(/Not sure/), "early");
    expect(onUpdate).toHaveBeenCalledWith({ chronotype: "early" });
  });

  it("describes caffeine sensitivity in self-assessable terms (issue #11)", () => {
    renderStep(null);
    // Descriptive option labels
    expect(
      screen.getByText(/afternoon coffee is fine, evening isn't/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/coffee after noon keeps me up/),
    ).toBeInTheDocument();
    // Plus the rule-of-thumb hint
    expect(screen.getByText(/Rule of thumb/)).toBeInTheDocument();
  });
});
