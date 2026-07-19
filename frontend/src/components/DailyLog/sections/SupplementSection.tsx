import { SectionWrapper } from "./SectionWrapper";
import { TimePicker } from "../../shared/TimePicker";
import { NumberInput } from "../../shared/NumberInput";
import type { SupplementEntryCreate } from "../../../types";

interface SupplementSectionProps {
  entries: SupplementEntryCreate[];
  onChange: (entries: SupplementEntryCreate[]) => void;
}

const COMMON_SUPPLEMENTS = [
  "Magnesium",
  "Melatonin",
  "L-Theanine",
  "Glycine",
  "Apigenin",
  "Vitamin D",
];

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
}

export function SupplementSection({
  entries,
  onChange,
}: SupplementSectionProps) {
  const addEntry = (name: string = "") =>
    onChange([...entries, { time: nowTimeStr(), name, dose_mg: null }]);
  const removeEntry = (index: number) =>
    onChange(entries.filter((_, i) => i !== index));
  const updateEntry = (index: number, updated: SupplementEntryCreate) =>
    onChange(entries.map((e, i) => (i === index ? updated : e)));

  return (
    <SectionWrapper
      title="Supplements"
      count={entries.length}
      storageKey="supplements"
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {COMMON_SUPPLEMENTS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => addEntry(name)}
            className="quick-add-btn"
          >
            + {name}
          </button>
        ))}
      </div>

      {entries.map((entry, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            padding: "0.75rem",
            border: "1px solid var(--color-border)",
            borderRadius: "6px",
          }}
        >
          <div>
            <label
              style={{
                fontSize: "0.85rem",
                color: "var(--color-text-secondary)",
              }}
            >
              Name
            </label>
            <input
              value={entry.name}
              onChange={(e) =>
                updateEntry(i, { ...entry, name: e.target.value })
              }
              style={{ width: "100%" }}
            />
          </div>
          <NumberInput
            label="Dose"
            value={entry.dose_mg}
            onChange={(v) => updateEntry(i, { ...entry, dose_mg: v })}
            unit="mg"
            min={0}
          />
          <TimePicker
            label="Time"
            value={entry.time}
            onChange={(v) => updateEntry(i, { ...entry, time: v })}
          />
          <button
            type="button"
            onClick={() => removeEntry(i)}
            style={{
              alignSelf: "flex-end",
              background: "transparent",
              color: "var(--color-error)",
              border: "none",
              fontSize: "0.8rem",
            }}
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => addEntry()}
        style={{
          background: "transparent",
          color: "var(--color-text-accent)",
          border: "1px dashed var(--color-border-light)",
          fontSize: "0.85rem",
          padding: "8px 16px",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        + Add custom supplement
      </button>
    </SectionWrapper>
  );
}
