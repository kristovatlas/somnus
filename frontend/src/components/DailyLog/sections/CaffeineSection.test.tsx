import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CaffeineSection } from "./CaffeineSection";

describe("CaffeineSection", () => {
  beforeEach(() => {
    localStorage.clear();
    // Default section to open
    localStorage.setItem("somnus-section-caffeine", "true");
  });

  it("renders quick-add buttons", () => {
    render(<CaffeineSection entries={[]} onChange={vi.fn()} />);
    expect(screen.getByText("+ Espresso (63mg)")).toBeInTheDocument();
    expect(screen.getByText("+ Coffee (95mg)")).toBeInTheDocument();
    expect(screen.getByText("+ Tea (47mg)")).toBeInTheDocument();
  });

  it("adds entry on quick-add click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CaffeineSection entries={[]} onChange={onChange} />);
    await user.click(screen.getByText("+ Coffee (95mg)"));
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ amount_mg: 95, source: "drip_coffee" }),
      ]),
    );
  });

  it("shows total when entries exist", () => {
    render(
      <CaffeineSection
        entries={[
          { time: "08:00:00", amount_mg: 95, source: "drip_coffee" },
          { time: "14:00:00", amount_mg: 63, source: "espresso" },
        ]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("158mg")).toBeInTheDocument();
  });

  it("removes entry on remove click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CaffeineSection
        entries={[{ time: "08:00:00", amount_mg: 95, source: "drip_coffee" }]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByText("Remove"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("renders add custom entry button", () => {
    render(<CaffeineSection entries={[]} onChange={vi.fn()} />);
    expect(screen.getByText("+ Add custom entry")).toBeInTheDocument();
  });
});
