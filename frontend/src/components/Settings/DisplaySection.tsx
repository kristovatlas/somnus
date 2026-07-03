import { useState } from "react";
import { SelectInput } from "../shared/SelectInput";
import { TimePicker } from "../shared/TimePicker";
import type { UserSettingsOut, UserSettingsUpdate } from "../../types";
import { DisplayMode } from "../../types";

interface DisplaySectionProps {
  settings: UserSettingsOut;
  onUpdate: (data: UserSettingsUpdate) => Promise<UserSettingsOut>;
}

const DISPLAY_MODE_OPTIONS = [
  DisplayMode.CIRCADIAN,
  DisplayMode.LIGHT,
  DisplayMode.AUTO,
] as const;
const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  circadian: "Circadian (amber/red)",
  light: "Light",
  auto: "Auto (time-based)",
};

export function DisplaySection({ settings, onUpdate }: DisplaySectionProps) {
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
        Display {saving && <span className="settings-saving">Saving...</span>}
      </h2>

      <div className="settings-fields">
        <SelectInput
          label="Display Mode"
          value={settings.display_mode}
          onChange={(v) => handleChange({ display_mode: v })}
          options={DISPLAY_MODE_OPTIONS}
          labels={DISPLAY_MODE_LABELS}
        />

        {(settings.display_mode === DisplayMode.CIRCADIAN ||
          settings.display_mode === DisplayMode.AUTO) && (
          <TimePicker
            label="Circadian Mode Start Time"
            value={settings.circadian_mode_start}
            onChange={(v) =>
              handleChange({ circadian_mode_start: v ?? "20:00:00" })
            }
          />
        )}
      </div>
    </section>
  );
}
