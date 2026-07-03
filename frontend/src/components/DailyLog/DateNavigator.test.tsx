import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DateNavigator } from "./DateNavigator";

describe("DateNavigator", () => {
  it("displays formatted date", () => {
    render(
      <DateNavigator
        date="2024-06-15"
        isToday={false}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />,
    );
    expect(screen.getByText(/Jun 15/)).toBeInTheDocument();
  });

  it("shows Today badge when isToday", () => {
    render(
      <DateNavigator
        date="2024-06-15"
        isToday
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />,
    );
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("shows Today button when not today", () => {
    render(
      <DateNavigator
        date="2024-06-14"
        isToday={false}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />,
    );
    // The Today button (not badge)
    const buttons = screen.getAllByRole("button");
    expect(buttons.some((b) => b.textContent === "Today")).toBe(true);
  });

  it("calls onPrev when left arrow clicked", async () => {
    const onPrev = vi.fn();
    const user = userEvent.setup();
    render(
      <DateNavigator
        date="2024-06-15"
        isToday={false}
        onPrev={onPrev}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText("Previous day"));
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it("calls onNext when right arrow clicked", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(
      <DateNavigator
        date="2024-06-15"
        isToday={false}
        onPrev={vi.fn()}
        onNext={onNext}
        onToday={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText("Next day"));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
