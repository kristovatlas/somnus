import { useState } from "react";
import { Toggle } from "../shared/Toggle";
import { StepNavigation } from "./StepNavigation";
import {
  TRACKED_SECTIONS,
  readTrackedSections,
  writeTrackedSections,
} from "../../trackedSections";
import type { SectionKey } from "../../trackedSections";

interface TrackingSetupStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function TrackingSetupStep({ onNext, onBack }: TrackingSetupStepProps) {
  const [selected, setSelected] =
    useState<Set<SectionKey>>(readTrackedSections);

  const toggle = (key: SectionKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleNext = () => {
    writeTrackedSections(selected);
    onNext();
  };

  return (
    <div>
      <h2>What do you want to track?</h2>
      <p
        style={{
          color: "var(--color-text-secondary)",
          margin: "0.5rem 0 1.5rem",
        }}
      >
        Choose which sections appear in your daily log. A section that already
        holds data always shows. You can change this anytime in Settings.
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

      <StepNavigation
        isFirst={false}
        isLast={false}
        onBack={onBack}
        onNext={handleNext}
      />
    </div>
  );
}
