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
      JSON.stringify({ v: 2, keys: ["caffeine", "bogus-key"] }),
    );
    expect(readTrackedSections()).toEqual(new Set(["caffeine"]));

    localStorage.setItem("somnus-tracked-sections", "not json{");
    expect(readTrackedSections()).toEqual(new Set(ALL));

    localStorage.setItem("somnus-tracked-sections", JSON.stringify({ a: 1 }));
    expect(readTrackedSections()).toEqual(new Set(ALL));
  });

  it("an empty v2 selection means nothing tracked (a deliberate choice)", () => {
    writeTrackedSections(new Set());
    expect(readTrackedSections()).toEqual(new Set());
  });

  it("writes the versioned format so future reads never guess", () => {
    writeTrackedSections(new Set(["caffeine"]));
    const raw = JSON.parse(localStorage.getItem("somnus-tracked-sections")!);
    expect(raw).toEqual({ v: 2, keys: ["caffeine"] });
  });

  it("a bare array is ALWAYS legacy: never-offered sections stay tracked", () => {
    // ["caffeine","sunlight"] was byte-ambiguous pre-versioning; legacy wins.
    localStorage.setItem(
      "somnus-tracked-sections",
      JSON.stringify(["caffeine", "sunlight"]),
    );
    const tracked = readTrackedSections();
    expect(tracked.has("stimulating")).toBe(true);
    expect(tracked.has("sexual")).toBe(true);
    expect(tracked.has("meals")).toBe(false);
  });

  it("prototype-chain names in stored values are inert", () => {
    localStorage.setItem(
      "somnus-tracked-sections",
      JSON.stringify(["toString", "constructor", "caffeine"]),
    );
    const tracked = readTrackedSections();
    // legacy array: caffeine kept, junk dropped, never-offered added
    expect(tracked.has("caffeine")).toBe(true);
    expect([...tracked].every((k) => typeof k === "string")).toBe(true);
  });
});
