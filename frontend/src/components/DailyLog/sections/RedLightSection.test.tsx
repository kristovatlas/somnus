import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { RedLightSection } from "./RedLightSection";
import type { RedLightEntryCreate } from "../../../types";

const panelA = {
  id: 1,
  name: "Panel A",
  wavelength_nm: 660,
  irradiance_mw_cm2: 100,
  default_distance_inches: 6,
  notes: null,
};
const panelB = {
  id: 2,
  name: "Panel B",
  wavelength_nm: 850,
  irradiance_mw_cm2: 50,
  default_distance_inches: 24,
  notes: null,
};

function setup(entries: RedLightEntryCreate[] = []) {
  const onChange = vi.fn();
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () => new Response(JSON.stringify([panelA, panelB])),
  );
  render(<RedLightSection entries={entries} onChange={onChange} />);
  return onChange;
}

describe("RedLightSection (#60 distance + dose)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("switching panel re-fills distance from the new panel's rated distance", async () => {
    const entry: RedLightEntryCreate = {
      panel_id: 1,
      start_time: null,
      duration_minutes: 10,
      distance_inches: 6,
    };
    const onChange = setup([entry]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Red Light/ }));

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "2");

    const updated = onChange.mock.calls.at(-1)![0][0] as RedLightEntryCreate;
    expect(updated.panel_id).toBe(2);
    // NOT the stale 6 measured against panel B's 24" reference (would 16x the dose)
    expect(updated.distance_inches).toBe(24);
  });

  it("shows a distance-adjusted dose that matches the backend formula", async () => {
    // Panel A: 100 mW/cm² rated at 6"; session at 12" → factor (6/12)²=0.25
    // dose = 100 * 0.25 * 10min * 60 / 1000 = 15 J/cm²
    const entry: RedLightEntryCreate = {
      panel_id: 1,
      start_time: null,
      duration_minutes: 10,
      distance_inches: 12,
    };
    setup([entry]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Red Light/ }));
    await waitFor(() => {
      expect(screen.getByText(/Dose: 15\.00 J\/cm²/)).toBeInTheDocument();
    });
  });

  it("no session distance → unadjusted dose (pre-#60 behavior)", async () => {
    const entry: RedLightEntryCreate = {
      panel_id: 1,
      start_time: null,
      duration_minutes: 10,
      distance_inches: null,
    };
    setup([entry]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Red Light/ }));
    await waitFor(() => {
      expect(screen.getByText(/Dose: 60\.00 J\/cm²/)).toBeInTheDocument();
    });
  });

  it("a non-positive typed distance is treated as unspecified (null)", async () => {
    const entry: RedLightEntryCreate = {
      panel_id: 1,
      start_time: null,
      duration_minutes: 10,
      distance_inches: 6,
    };
    const onChange = setup([entry]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Red Light/ }));

    const card = screen.getByText("Distance").closest("div")!;
    const input = within(card).getByRole("spinbutton");
    await user.clear(input);
    const updated = onChange.mock.calls.at(-1)![0][0] as RedLightEntryCreate;
    expect(updated.distance_inches).toBeNull();
  });

  it("a panel with a zero rated distance prefills null, not an unsavable 0", async () => {
    const zeroPanel = { ...panelA, id: 3, default_distance_inches: 0 };
    const onChange = vi.fn();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify([zeroPanel])),
    );
    render(<RedLightSection entries={[]} onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Red Light/ }));
    await user.click(screen.getByText("+ Add session"));
    const added = onChange.mock.calls.at(-1)![0][0] as RedLightEntryCreate;
    expect(added.distance_inches).toBeNull();
  });
});
