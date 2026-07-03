import { SectionWrapper } from "./SectionWrapper";
import { TimePicker } from "../../shared/TimePicker";
import { SelectInput } from "../../shared/SelectInput";
import {
  SexualActivityType,
  SEXUAL_ACTIVITY_LABELS,
} from "../../../types/enums";
import type { SexualActivityCreate } from "../../../types";

interface SexualActivitySectionProps {
  entry: SexualActivityCreate | null;
  onChange: (entry: SexualActivityCreate | null) => void;
}

export function SexualActivitySection({
  entry,
  onChange,
}: SexualActivitySectionProps) {
  const count = entry ? 1 : 0;

  return (
    <SectionWrapper
      title="Sexual Activity"
      count={count}
      storageKey="sexual-activity"
    >
      {entry ? (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <SelectInput
            label="Type"
            value={entry.activity_type}
            onChange={(v) => onChange({ ...entry, activity_type: v })}
            options={Object.values(SexualActivityType)}
            labels={SEXUAL_ACTIVITY_LABELS}
          />
          <TimePicker
            label="Time"
            value={entry.time}
            onChange={(v) => onChange({ ...entry, time: v })}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
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
      ) : (
        <button
          type="button"
          onClick={() =>
            onChange({
              time: null,
              activity_type: SexualActivityType.PARTNERED,
            })
          }
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
          + Record
        </button>
      )}
    </SectionWrapper>
  );
}
