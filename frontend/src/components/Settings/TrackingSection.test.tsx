import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { TrackingSection } from "./TrackingSection";
import { readTrackedSections, TRACKED_SECTIONS } from "../../trackedSections";

describe("TrackingSection", () => {
  beforeEach(() => localStorage.clear());

  it("renders a toggle per section, all on by default", () => {
    render(<TrackingSection />);
    expect(screen.getByText("Tracked Sections")).toBeInTheDocument();
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(TRACKED_SECTIONS.length);
    for (const toggle of switches) {
      expect(toggle).toHaveAttribute("aria-checked", "true");
    }
  });

  it("toggling persists immediately and round-trips", async () => {
    const user = userEvent.setup();
    render(<TrackingSection />);

    const naps = screen.getByRole("switch", { name: /Naps/ });
    await user.click(naps);
    expect(readTrackedSections().has("naps")).toBe(false);
    expect(naps).toHaveAttribute("aria-checked", "false");

    await user.click(naps);
    expect(readTrackedSections().has("naps")).toBe(true);
  });

  it("reflects a previously saved selection", () => {
    localStorage.setItem(
      "somnus-tracked-sections",
      JSON.stringify({ v: 2, keys: ["caffeine"] }),
    );
    render(<TrackingSection />);
    expect(screen.getByRole("switch", { name: /Caffeine/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("switch", { name: /Naps/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});
