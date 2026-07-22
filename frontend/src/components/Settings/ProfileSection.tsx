import { useState } from "react";
import { NumberInput } from "../shared/NumberInput";
import { SelectInput } from "../shared/SelectInput";
import { TimePicker } from "../shared/TimePicker";
import { timezoneOptions } from "../../timezones";
import type { UserSettingsOut, UserSettingsUpdate } from "../../types";
import {
  CaffeineSensitivity,
  CAFFEINE_SENSITIVITY_LABELS,
  CHRONOTYPE_CHOICES,
  CHRONOTYPE_CHOICE_LABELS,
  CHRONOTYPE_UNKNOWN,
} from "../../types";

interface ProfileSectionProps {
  settings: UserSettingsOut;
  onUpdate: (data: UserSettingsUpdate) => Promise<UserSettingsOut>;
}

const SENSITIVITY_OPTIONS = [
  CaffeineSensitivity.FAST,
  CaffeineSensitivity.NORMAL,
  CaffeineSensitivity.SLOW,
] as const;

export function ProfileSection({ settings, onUpdate }: ProfileSectionProps) {
  const [saving, setSaving] = useState(false);

  async function handleChange(data: UserSettingsUpdate) {
    setSaving(true);
    try {
      await onUpdate(data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section-title">
        Profile {saving && <span className="settings-saving">Saving...</span>}
      </h2>

      <div className="settings-fields">
        <NumberInput
          label="Age"
          value={settings.age}
          onChange={(v) => handleChange({ age: v })}
          min={1}
          max={120}
        />

        <div className="settings-field">
          <label className="settings-field-label" htmlFor="timezone">
            Timezone
          </label>
          <select
            id="timezone"
            value={settings.timezone}
            onChange={(e) => handleChange({ timezone: e.target.value })}
          >
            {timezoneOptions(settings.timezone).map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        <TimePicker
          label="Target Bedtime (optional)"
          value={settings.typical_bedtime}
          onChange={(v) => handleChange({ typical_bedtime: v })}
        />

        <TimePicker
          label="Target Wake Time (optional)"
          value={settings.target_wake_time}
          onChange={(v) => handleChange({ target_wake_time: v })}
        />

        <p className="settings-field-hint">
          Your bedtime target powers the bedtime countdown, the caffeine chart's
          bedtime marker, and your consistency stats. Your wake target sets when
          Auto display mode switches for the day.
        </p>

        <SelectInput
          label="Chronotype"
          value={settings.chronotype ?? CHRONOTYPE_UNKNOWN}
          onChange={(v) =>
            handleChange({ chronotype: v === CHRONOTYPE_UNKNOWN ? null : v })
          }
          options={CHRONOTYPE_CHOICES}
          labels={CHRONOTYPE_CHOICE_LABELS}
        />

        <SelectInput
          label="Caffeine Sensitivity"
          value={settings.caffeine_sensitivity}
          onChange={(v) => handleChange({ caffeine_sensitivity: v })}
          options={SENSITIVITY_OPTIONS}
          labels={CAFFEINE_SENSITIVITY_LABELS}
        />
      </div>
    </section>
  );
}
