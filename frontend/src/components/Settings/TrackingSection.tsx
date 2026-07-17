import { useState } from "react";
import { Toggle } from "../shared/Toggle";
import {
  TRACKED_SECTIONS,
  readTrackedSections,
  writeTrackedSections,
} from "../../trackedSections";
import type { SectionKey } from "../../trackedSections";

/** #47: post-onboarding editor for which Daily Log sections render.
 * Device-scoped (localStorage), applied on the next Daily Log visit;
 * sections that already hold data for a day always render there. */
export function TrackingSection() {
  const [selected, setSelected] =
    useState<Set<SectionKey>>(readTrackedSections);

  const toggle = (key: SectionKey) => {
    // Persist outside the updater: StrictMode double-invokes updaters.
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
    writeTrackedSections(next);
  };

  return (
    <section className="settings-section">
      <h2 className="settings-section-title">Tracked Sections</h2>
      <p
        style={{
          color: "var(--color-text-secondary)",
          fontSize: "0.85rem",
          margin: "0 0 0.75rem",
        }}
      >
        Choose which sections appear in the Daily Log on this device. A section
        that already holds data for a day always shows.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {TRACKED_SECTIONS.map((item) => (
          <Toggle
            key={item.key}
            label={item.label}
            checked={selected.has(item.key)}
            onChange={() => toggle(item.key)}
          />
        ))}
      </div>
    </section>
  );
}
