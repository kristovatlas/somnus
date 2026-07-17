import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NSDRSection } from "./NSDRSection";
import { NSDRType } from "../../../types/enums";
import type { NSDREntryCreate } from "../../../types";

function setup(entries: NSDREntryCreate[] = []) {
  const onChange = vi.fn();
  render(<NSDRSection entries={entries} onChange={onChange} />);
  return onChange;
}

describe("NSDRSection (#61)", () => {
  beforeEach(() => localStorage.clear());

  it("quick-adds keep their fixed durations", async () => {
    const onChange = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /NSDR/ })); // expand
    await user.click(screen.getByText("+ 20 min"));
    const added = onChange.mock.calls[0][0][0] as NSDREntryCreate;
    expect(added.duration_minutes).toBe(20);
    expect(added.nsdr_type).toBe(NSDRType.YOGA_NIDRA);
  });

  it("generic add creates an entry with no preset duration", async () => {
    const onChange = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /NSDR/ }));
    await user.click(screen.getByText("+ Custom"));
    const added = onChange.mock.calls[0][0][0] as NSDREntryCreate;
    expect(added.duration_minutes).toBeNull();
  });

  it("duration is editable after adding, integerized and floored at 1", async () => {
    const entry: NSDREntryCreate = {
      time: "14:00:00",
      duration_minutes: 20,
      nsdr_type: NSDRType.YOGA_NIDRA,
    };
    const onChange = setup([entry]);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /NSDR/ }));

    const input = screen.getByRole("spinbutton"); // NumberInput
    await user.clear(input);
    await user.type(input, "37.6");
    const last = onChange.mock.calls.at(-1)![0][0] as NSDREntryCreate;
    expect(last.duration_minutes).toBe(38);
  });
});
