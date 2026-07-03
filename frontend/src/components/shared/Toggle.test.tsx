import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("shows an explicit Off state label (issue #12)", () => {
    render(<Toggle label="Naps" checked={false} onChange={vi.fn()} />);
    expect(screen.getByText("Off")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("shows an explicit On state label (issue #12)", () => {
    render(<Toggle label="Naps" checked={true} onChange={vi.fn()} />);
    expect(screen.getByText("On")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("treats null as off and toggles to on", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle label="Naps" checked={null} onChange={onChange} />);
    expect(screen.getByText("Off")).toBeInTheDocument();
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
