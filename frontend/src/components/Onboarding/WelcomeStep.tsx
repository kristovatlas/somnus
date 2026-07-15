import { NumberInput } from "../shared/NumberInput";
import { SelectInput } from "../shared/SelectInput";
import { StepNavigation } from "./StepNavigation";
import type { UserSettingsUpdate } from "../../types";

import {
  CURATED_TIMEZONES as TIMEZONES,
  CURATED_TIMEZONE_LABELS as TIMEZONE_LABELS,
} from "../../timezones";

interface WelcomeStepProps {
  age: number | null;
  timezone: string;
  onUpdate: (data: UserSettingsUpdate) => void;
  onNext: () => void;
}

export function WelcomeStep({
  age,
  timezone,
  onUpdate,
  onNext,
}: WelcomeStepProps) {
  return (
    <div>
      <h2>Welcome to Somnus</h2>
      <p
        style={{
          color: "var(--color-text-secondary)",
          margin: "0.5rem 0 1.5rem",
        }}
      >
        Let&apos;s set up your sleep optimization profile. This takes about 2
        minutes.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <NumberInput
          label="Age"
          value={age}
          onChange={(v) => onUpdate({ age: v })}
          min={1}
          max={120}
        />
        <SelectInput
          label="Timezone"
          value={timezone}
          onChange={(v) => onUpdate({ timezone: v })}
          options={[...TIMEZONES]}
          labels={TIMEZONE_LABELS}
        />
      </div>

      <StepNavigation
        isFirst
        isLast={false}
        onBack={() => {}}
        onNext={onNext}
        nextLabel="Get Started"
      />
    </div>
  );
}
