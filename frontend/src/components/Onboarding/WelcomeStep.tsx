import { NumberInput } from "../shared/NumberInput";
import { SelectInput } from "../shared/SelectInput";
import { StepNavigation } from "./StepNavigation";
import type { UserSettingsUpdate } from "../../types";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

const TIMEZONE_LABELS: Record<string, string> = {
  "America/New_York": "Eastern (US)",
  "America/Chicago": "Central (US)",
  "America/Denver": "Mountain (US)",
  "America/Los_Angeles": "Pacific (US)",
  "America/Anchorage": "Alaska",
  "Pacific/Honolulu": "Hawaii",
  "Europe/London": "London",
  "Europe/Berlin": "Berlin",
  "Asia/Tokyo": "Tokyo",
  "Australia/Sydney": "Sydney",
};

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
