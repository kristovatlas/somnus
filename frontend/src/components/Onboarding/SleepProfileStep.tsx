import { TimePicker } from "../shared/TimePicker";
import { SelectInput } from "../shared/SelectInput";
import { StepNavigation } from "./StepNavigation";
import {
  CaffeineSensitivity,
  CAFFEINE_SENSITIVITY_LABELS,
  type Chronotype,
  CHRONOTYPE_CHOICES,
  CHRONOTYPE_CHOICE_LABELS,
  CHRONOTYPE_UNKNOWN,
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

const hintStyle = {
  color: "var(--color-text-muted)",
  fontSize: "0.8rem",
  margin: "-0.5rem 0 0",
} as const;

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
        <p style={hintStyle}>
          Rule of thumb: if coffee at 5 PM doesn't affect your sleep you're
          fast; if coffee after noon keeps you up you're slow. Not sure? Leave
          it on normal — your data will tell.
        </p>
        <SelectInput
          label="Chronotype"
          value={chronotype ?? CHRONOTYPE_UNKNOWN}
          onChange={(v) =>
            onUpdate({ chronotype: v === CHRONOTYPE_UNKNOWN ? null : v })
          }
          options={CHRONOTYPE_CHOICES}
          labels={CHRONOTYPE_CHOICE_LABELS}
        />
        <p style={hintStyle}>
          "Not sure" is a great default: after ~30 days Somnus infers your
          chronotype from when you actually sleep. Self-labels like "night owl"
          often reflect habits rather than biology and can bias your analysis.
        </p>
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
