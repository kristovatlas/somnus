import { SectionWrapper } from "./SectionWrapper";
import { TimePicker } from "../../shared/TimePicker";
import { NumberInput } from "../../shared/NumberInput";
import type { NapEntryCreate } from "../../../types";

interface NapSectionProps {
  entries: NapEntryCreate[];
  onChange: (entries: NapEntryCreate[]) => void;
}

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
}

export function NapSection({ entries, onChange }: NapSectionProps) {
  const addQuickNap = (minutes: number) =>
    onChange([
      ...entries,
      { start_time: nowTimeStr(), end_time: null, duration_minutes: minutes },
    ]);
  const removeEntry = (index: number) =>
    onChange(entries.filter((_, i) => i !== index));
  const updateEntry = (index: number, updated: NapEntryCreate) =>
    onChange(entries.map((e, i) => (i === index ? updated : e)));

  return (
    <SectionWrapper title="Naps" count={entries.length} storageKey="naps">
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={() => addQuickNap(20)}
          style={{
            fontSize: "0.8rem",
            padding: "4px 10px",
            background: "var(--color-bg-elevated)",
            color: "var(--color-text-accent)",
            border: "1px solid var(--color-border-light)",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          + 20 min nap
        </button>
        <button
          type="button"
          onClick={() => addQuickNap(90)}
          style={{
            fontSize: "0.8rem",
            padding: "4px 10px",
            background: "var(--color-bg-elevated)",
            color: "var(--color-text-accent)",
            border: "1px solid var(--color-border-light)",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          + 90 min nap
        </button>
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
          <TimePicker
            label="Start Time"
            value={entry.start_time}
            onChange={(v) => updateEntry(i, { ...entry, start_time: v })}
          />
          <TimePicker
            label="End Time"
            value={entry.end_time}
            onChange={(v) => updateEntry(i, { ...entry, end_time: v })}
          />
          <NumberInput
            label="Duration"
            value={entry.duration_minutes}
            onChange={(v) => updateEntry(i, { ...entry, duration_minutes: v })}
            unit="min"
            min={1}
            max={240}
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
    </SectionWrapper>
  );
}
