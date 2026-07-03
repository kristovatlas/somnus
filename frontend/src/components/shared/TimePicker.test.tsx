import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TimePicker } from "./TimePicker";

describe("TimePicker", () => {
  it("renders label", () => {
    render(<TimePicker label="Start Time" value={null} onChange={vi.fn()} />);
    expect(screen.getByText("Start Time")).toBeInTheDocument();
  });

  it("renders Now button", () => {
    render(<TimePicker label="Time" value={null} onChange={vi.fn()} />);
    expect(screen.getByText("Now")).toBeInTheDocument();
  });

  it("calls onChange with current time on Now click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimePicker label="Time" value={null} onChange={onChange} />);
    await user.click(screen.getByText("Now"));
    expect(onChange).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{2}:\d{2}:00$/),
    );
  });

  it("displays value in input", () => {
    render(<TimePicker label="Time" value="14:30:00" onChange={vi.fn()} />);
    const input = screen.getByDisplayValue("14:30");
    expect(input).toBeInTheDocument();
  });
});
