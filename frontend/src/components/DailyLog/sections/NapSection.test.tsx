import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NapSection } from "./NapSection";
import type { NapEntryCreate } from "../../../types";

/** Stateful harness so entry updates round-trip like in DailyLogPage. */
function Harness({ initial = [] }: { initial?: NapEntryCreate[] }) {
  const [entries, setEntries] = useState<NapEntryCreate[]>(initial);
  return <NapSection entries={entries} onChange={setEntries} />;
}

function getTimeInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll('input[type="time"]'));
}

function getDurationInput(): HTMLInputElement {
  const input = document.querySelector('input[type="number"]');
  if (!input) throw new Error("duration input not found");
  return input as HTMLInputElement;
}

describe("NapSection", () => {
  beforeEach(() => {
    // Sections persist collapsed state; force open so children render
    localStorage.setItem("somnus-section-naps", "true");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-07-03T14:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("quick-add fills start, duration, AND end time (issue #13)", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "+ 20 min nap" }));

    const [start, end] = getTimeInputs();
    expect(start.value).toBe("14:00");
    expect(end.value).toBe("14:20");
    expect(getDurationInput().value).toBe("20");
  });

  it("quick-add 90 min sets duration 90", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "+ 90 min nap" }));

    expect(getDurationInput().value).toBe("90");
    expect(getTimeInputs()[1].value).toBe("15:30");
  });

  it("computes duration from start + end", async () => {
    render(
      <Harness
        initial={[{ start_time: null, end_time: null, duration_minutes: null }]}
      />,
    );

    const [start, end] = getTimeInputs();
    // jsdom keystroke simulation on time inputs is unreliable; fire the
    // committed change event directly
    fireEvent.change(start, { target: { value: "14:00" } });
    fireEvent.change(end, { target: { value: "14:45" } });

    expect(getDurationInput().value).toBe("45");
  });

  it("computes end from start + duration", async () => {
    render(
      <Harness
        initial={[
          { start_time: "13:00:00", end_time: null, duration_minutes: null },
        ]}
      />,
    );
    const user = userEvent.setup();

    await user.type(getDurationInput(), "30");

    expect(getTimeInputs()[1].value).toBe("13:30");
  });

  it("moving start time shifts end when duration is set", async () => {
    render(
      <Harness
        initial={[
          {
            start_time: "13:00:00",
            end_time: "13:20:00",
            duration_minutes: 20,
          },
        ]}
      />,
    );
    const [start] = getTimeInputs();
    fireEvent.change(start, { target: { value: "15:00" } });

    expect(getTimeInputs()[1].value).toBe("15:20");
    expect(getDurationInput().value).toBe("20");
  });

  it("changing duration moves the end time", async () => {
    render(
      <Harness
        initial={[
          {
            start_time: "13:00:00",
            end_time: "13:20:00",
            duration_minutes: 20,
          },
        ]}
      />,
    );
    const user = userEvent.setup();

    const duration = getDurationInput();
    await user.clear(duration);
    await user.type(duration, "45");

    expect(getTimeInputs()[1].value).toBe("13:45");
  });

  it("removes an entry", async () => {
    render(
      <Harness
        initial={[
          { start_time: "13:00:00", end_time: null, duration_minutes: 20 },
        ]}
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(getTimeInputs()).toHaveLength(0);
  });
});
