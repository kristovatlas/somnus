import { TimePicker } from "../shared/TimePicker";
import { SelectInput } from "../shared/SelectInput";
import { StepNavigation } from "./StepNavigation";
import {
  CaffeineSensitivity,
  CAFFEINE_SENSITIVITY_LABELS,
  Chronotype,
  CHRONOTYPE_LABELS,
} from "../../types/enums";
import type { UserSettingsUpdate } from "../../types";

interface SleepProfileStepProps {
  typicalBedtime: string | null;
  targetWakeTime: string | null;
  caffeineSensitivity: CaffeineSensitivity;
  chronotype: Chronotype | null;
  onUpdate: (data: UserSettingsUpdate) => void;
  onNext: () => void;
  onBack: () => void;
}

export function SleepProfileStep({
  typicalBedtime,
  targetWakeTime,
  caffeineSensitivity,
  chronotype,
  onUpdate,
  onNext,
  onBack,
}: SleepProfileStepProps) {
  return (
    <div>
      <h2>Sleep Profile</h2>
      <p
        style={{
          color: "var(--color-text-secondary)",
          margin: "0.5rem 0 1.5rem",
        }}
      >
        Help us understand your sleep patterns.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <TimePicker
          label="Typical Bedtime"
          value={typicalBedtime}
          onChange={(v) => onUpdate({ typical_bedtime: v })}
        />
        <TimePicker
          label="Target Wake Time"
          value={targetWakeTime}
          onChange={(v) => onUpdate({ target_wake_time: v })}
        />
        <SelectInput
          label="Caffeine Sensitivity"
          value={caffeineSensitivity}
          onChange={(v) => onUpdate({ caffeine_sensitivity: v })}
          options={Object.values(CaffeineSensitivity)}
          labels={CAFFEINE_SENSITIVITY_LABELS}
        />
        <SelectInput
          label="Chronotype"
          value={chronotype ?? Chronotype.INTERMEDIATE}
          onChange={(v) => onUpdate({ chronotype: v })}
          options={Object.values(Chronotype)}
          labels={CHRONOTYPE_LABELS}
        />
      </div>

      <StepNavigation
        isFirst={false}
        isLast={false}
        onBack={onBack}
        onNext={onNext}
      />
    </div>
  );
}
