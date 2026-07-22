// #99: browsers mutate a focused number input on scroll-wheel; the guard
// blurs on wheel so the wheel scrolls the page instead of editing data.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NumberInput } from "./NumberInput";

describe("NumberInput wheel guard (#99)", () => {
  it("blurs the input on wheel so the browser cannot spin the value", () => {
    render(
      <NumberInput label="Amount" value={80} onChange={vi.fn()} unit="mg" />,
    );
    const input = screen.getByRole("spinbutton");
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.wheel(input, { deltaY: -120 });
    expect(document.activeElement).not.toBe(input);
  });

  it("still edits normally via change events", () => {
    const onChange = vi.fn();
    render(<NumberInput label="Amount" value={80} onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "95" },
    });
    expect(onChange).toHaveBeenCalledWith(95);
  });
});
