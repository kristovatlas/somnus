import type { WheelEvent } from "react";

// #99: browsers mutate a focused+hovered <input type="number"> by ±step per
// scroll-wheel detent instead of scrolling the page — silent data corruption
// when scrolling past a just-edited field (80 mg became 68 = 12 detents).
// Blurring on wheel makes the wheel scroll the page instead. Attach to every
// numeric input.
export function blurOnWheel(e: WheelEvent<HTMLInputElement>): void {
  e.currentTarget.blur();
}
