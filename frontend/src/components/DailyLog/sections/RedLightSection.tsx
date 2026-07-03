import { useEffect, useState } from "react";
import { SectionWrapper } from "./SectionWrapper";
import { TimePicker } from "../../shared/TimePicker";
import { NumberInput } from "../../shared/NumberInput";
import { listPanels, type RedLightPanelOut } from "../../../api/redLightPanels";
import type { RedLightEntryCreate } from "../../../types";

interface RedLightSectionProps {
  entries: RedLightEntryCreate[];
  onChange: (entries: RedLightEntryCreate[]) => void;
}

export function RedLightSection({ entries, onChange }: RedLightSectionProps) {
  const [panels, setPanels] = useState<RedLightPanelOut[]>([]);

  useEffect(() => {
    listPanels()
      .then(setPanels)
      .catch(() => {});
  }, []);

  const addEntry = () =>
    onChange([
      ...entries,
      {
        panel_id: panels[0]?.id ?? null,
        start_time: null,
        duration_minutes: null,
      },
    ]);
  const removeEntry = (index: number) =>
    onChange(entries.filter((_, i) => i !== index));
  const updateEntry = (index: number, updated: RedLightEntryCreate) =>
    onChange(entries.map((e, i) => (i === index ? updated : e)));

  const getDose = (entry: RedLightEntryCreate): string | null => {
    if (!entry.panel_id || !entry.duration_minutes) return null;
    const panel = panels.find((p) => p.id === entry.panel_id);
    if (!panel?.irradiance_mw_cm2) return null;
    const joules =
      (panel.irradiance_mw_cm2 * entry.duration_minutes * 60) / 1000;
    return `${joules.toFixed(2)} J/cm²`;
  };

  return (
    <SectionWrapper
      title="Red Light Therapy"
      count={entries.length}
      storageKey="redLight"
    >
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
          {panels.length > 0 && (
            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  color: "var(--color-text-secondary)",
                }}
              >
                Panel
              </label>
              <select
                value={entry.panel_id ?? ""}
                onChange={(e) =>
                  updateEntry(i, {
                    ...entry,
                    panel_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
                style={{ width: "100%" }}
              >
                <option value="">No panel</option>
                {panels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <TimePicker
            label="Start Time"
            value={entry.start_time}
            onChange={(v) => updateEntry(i, { ...entry, start_time: v })}
          />
          <NumberInput
            label="Duration"
            value={entry.duration_minutes}
            onChange={(v) => updateEntry(i, { ...entry, duration_minutes: v })}
            unit="min"
            min={1}
            max={60}
          />
          {getDose(entry) && (
            <p
              style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}
            >
              Dose: {getDose(entry)}
            </p>
          )}
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
        onClick={addEntry}
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
        + Add session
      </button>
    </SectionWrapper>
  );
}
