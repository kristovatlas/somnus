import { describe, it, expect, beforeEach } from "vitest";
import {
  TRACKED_SECTIONS,
  readTrackedSections,
  writeTrackedSections,
} from "./trackedSections";

const ALL = TRACKED_SECTIONS.map((s) => s.key);

describe("trackedSections storage", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to everything tracked when nothing is stored", () => {
    expect(readTrackedSections()).toEqual(new Set(ALL));
  });

  it("round-trips a selection", () => {
    writeTrackedSections(new Set(["caffeine", "naps"]));
    expect(readTrackedSections()).toEqual(new Set(["caffeine", "naps"]));
  });

  it("migrates legacy pseudo-item keys to real sections", () => {
    // Pre-#47 onboarding stored habit TYPES and never offered
    // stimulating/sexual — those default to tracked after migration.
    localStorage.setItem(
      "somnus-tracked-sections",
      JSON.stringify(["caffeine", "exercise", "screens", "redLight"]),
    );
    const tracked = readTrackedSections();
    expect(tracked.has("caffeine")).toBe(true);
    expect(tracked.has("habits")).toBe(true); // exercise/screens → habits
    expect(tracked.has("redLight")).toBe(true);
    expect(tracked.has("stimulating")).toBe(true); // never offered → on
    expect(tracked.has("sexual")).toBe(true); // never offered → on
    expect(tracked.has("meals")).toBe(false); // was off in the legacy set
  });

  it("ignores unknown keys and survives corrupt values", () => {
    localStorage.setItem(
      "somnus-tracked-sections",
      JSON.stringify(["caffeine", "bogus-key"]),
    );
    expect(readTrackedSections()).toEqual(new Set(["caffeine"]));

    localStorage.setItem("somnus-tracked-sections", "not json{");
    expect(readTrackedSections()).toEqual(new Set(ALL));

    localStorage.setItem("somnus-tracked-sections", JSON.stringify({ a: 1 }));
    expect(readTrackedSections()).toEqual(new Set(ALL));
  });

  it("an empty stored array means nothing tracked (a deliberate choice)", () => {
    writeTrackedSections(new Set());
    expect(readTrackedSections()).toEqual(new Set());
  });
});
