import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SunlightSection } from "./SunlightSection";
import type { SunlightEntryCreate } from "../../../types";

const baseEntry: SunlightEntryCreate = {
  start_time: "08:00:00",
  duration_minutes: 30,
  estimated_lux: null,
  notes: null,
};

function setup(entries: SunlightEntryCreate[] = [baseEntry]) {
  const onChange = vi.fn();
  render(<SunlightSection entries={entries} onChange={onChange} />);
  return onChange;
}

/** Stateful harness so chip clicks actually update the entry, letting us
 *  exercise the preset -> manual-edit sequence end to end. */
function Harness({ initial }: { initial: SunlightEntryCreate[] }) {
  const [entries, setEntries] = useState(initial);
  return <SunlightSection entries={entries} onChange={setEntries} />;
}

async function expand(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Sunlight/ }));
}

describe("SunlightSection lux presets (#108)", () => {
  beforeEach(() => localStorage.clear());

  it("clicking a preset sets the entry's estimated lux via onChange", async () => {
    const onChange = setup();
    const user = userEvent.setup();
    await expand(user);
    await user.click(screen.getByText("Partly cloudy (20,000 lux)"));
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as SunlightEntryCreate[];
    expect(updated).toHaveLength(1);
    expect(updated[0].estimated_lux).toBe(20000);
    // Other fields are preserved — same shape as a manual edit.
    expect(updated[0].start_time).toBe("08:00:00");
    expect(updated[0].duration_minutes).toBe(30);
    expect(updated[0].notes).toBeNull();
  });

  it.each([
    ["Heavy overcast (1,000 lux)", 1000],
    ["Overcast (5,000 lux)", 5000],
    ["Partly cloudy (20,000 lux)", 20000],
    ["Full sun (80,000 lux)", 80000],
    ["Indoor, by window (1,000 lux)", 1000],
  ])("preset %s writes %d", async (label, lux) => {
    const onChange = setup();
    const user = userEvent.setup();
    await expand(user);
    await user.click(screen.getByText(label));
    const updated = onChange.mock.calls.at(-1)![0] as SunlightEntryCreate[];
    expect(updated[0].estimated_lux).toBe(lux);
  });

  it("indoor-by-window and heavy overcast are distinct chips", async () => {
    setup();
    const user = userEvent.setup();
    await expand(user);
    expect(screen.getByText("Indoor, by window (1,000 lux)")).not.toBe(
      screen.getByText("Heavy overcast (1,000 lux)"),
    );
  });

  it("manual entry still works after using a preset", async () => {
    render(<Harness initial={[baseEntry]} />);
    const user = userEvent.setup();
    await expand(user);

    await user.click(screen.getByText("Full sun (80,000 lux)"));
    // Spinbuttons per entry: [0] Duration, [1] Estimated Lux.
    const luxInput = screen.getAllByRole("spinbutton")[1] as HTMLInputElement;
    expect(luxInput.value).toBe("80000");

    // Controlled input: use a single change event, not per-keystroke typing.
    fireEvent.change(luxInput, { target: { value: "12345" } });
    expect(luxInput.value).toBe("12345");

    // Clearing the field still maps to null ("not recorded", ADR 003).
    fireEvent.change(luxInput, { target: { value: "" } });
    expect(luxInput.value).toBe("");
  });

  it("presets target the entry they belong to", async () => {
    const second: SunlightEntryCreate = {
      start_time: "13:00:00",
      duration_minutes: 10,
      estimated_lux: 500,
      notes: null,
    };
    const onChange = setup([baseEntry, second]);
    const user = userEvent.setup();
    await expand(user);
    const chips = screen.getAllByText("Overcast (5,000 lux)");
    expect(chips).toHaveLength(2);
    await user.click(chips[1]);
    const updated = onChange.mock.calls[0][0] as SunlightEntryCreate[];
    expect(updated[0].estimated_lux).toBeNull(); // first entry untouched
    expect(updated[1].estimated_lux).toBe(5000);
  });

  it("renders no preset chips when there are no entries", async () => {
    setup([]);
    const user = userEvent.setup();
    await expand(user);
    expect(screen.queryByText("Full sun (80,000 lux)")).toBeNull();
  });
});
