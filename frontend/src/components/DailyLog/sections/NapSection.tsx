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

/** "HH:MM[:SS]" → minutes since midnight, or null. */
function timeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const [hh, mm] = t.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function minutesToTimeStr(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hh = Math.floor(wrapped / 60);
  const mm = Math.round(wrapped % 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

type NapField = "start_time" | "end_time" | "duration_minutes";

/**
 * Derive whichever of start/end/duration follows from the other two, so the
 * user only ever has to provide two of the three.
 *
 * Anchoring rules: editing duration (or start, when a duration exists) moves
 * the end time; editing the end time recomputes the duration.
 */
function reconcile(entry: NapEntryCreate, changed: NapField): NapEntryCreate {
  const start = timeToMinutes(entry.start_time);
  const end = timeToMinutes(entry.end_time);

  if (changed === "duration_minutes") {
    if (entry.duration_minutes == null) return entry;
    if (start != null) {
      return {
        ...entry,
        end_time: minutesToTimeStr(start + entry.duration_minutes),
      };
    }
    if (end != null) {
      return {
        ...entry,
        start_time: minutesToTimeStr(end - entry.duration_minutes),
      };
    }
    return entry;
  }

  if (
    changed === "start_time" &&
    start != null &&
    entry.duration_minutes != null
  ) {
    return {
      ...entry,
      end_time: minutesToTimeStr(start + entry.duration_minutes),
    };
  }

  if (start != null && end != null) {
    // Naps shouldn't cross midnight, but wrap rather than produce negatives
    const diff = end - start;
    return { ...entry, duration_minutes: diff > 0 ? diff : diff + 1440 };
  }

  if (changed === "end_time" && end != null && entry.duration_minutes != null) {
    return {
      ...entry,
      start_time: minutesToTimeStr(end - entry.duration_minutes),
    };
  }

  return entry;
}

const quickAddStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  padding: "4px 10px",
  background: "var(--color-bg-elevated)",
  color: "var(--color-text-accent)",
  border: "1px solid var(--color-border-light)",
  borderRadius: "6px",
  cursor: "pointer",
};

export function NapSection({ entries, onChange }: NapSectionProps) {
  const addQuickNap = (minutes: number) =>
    onChange([
      ...entries,
      reconcile(
        { start_time: nowTimeStr(), end_time: null, duration_minutes: minutes },
        "duration_minutes",
      ),
    ]);
  const removeEntry = (index: number) =>
    onChange(entries.filter((_, i) => i !== index));
  const updateField = (
    index: number,
    field: NapField,
    value: string | number | null,
  ) =>
    onChange(
      entries.map((e, i) =>
        i === index ? reconcile({ ...e, [field]: value }, field) : e,
      ),
    );

  return (
    <SectionWrapper title="Naps" count={entries.length} storageKey="naps">
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={() => addQuickNap(20)}
          style={quickAddStyle}
        >
          + 20 min nap
        </button>
        <button
          type="button"
          onClick={() => addQuickNap(90)}
          style={quickAddStyle}
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
            onChange={(v) => updateField(i, "start_time", v)}
          />
          <TimePicker
            label="End Time"
            value={entry.end_time}
            onChange={(v) => updateField(i, "end_time", v)}
          />
          <NumberInput
            label="Duration"
            value={entry.duration_minutes}
            onChange={(v) => updateField(i, "duration_minutes", v)}
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
