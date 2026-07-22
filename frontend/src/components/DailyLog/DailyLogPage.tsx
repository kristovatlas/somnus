import { useEffect, useState } from "react";
import { useDateNavigation } from "../../hooks/useDateNavigation";
import { useDailyLog } from "../../hooks/useDailyLog";
import { useCaffeineDecay } from "../../hooks/useCaffeineDecay";
import { getSettings } from "../../api/settings";
import type { UserSettingsOut, DailyLogCreate, DailyLogOut } from "../../types";
import { DateNavigator } from "./DateNavigator";
import { CopyDayButton } from "./CopyDayButton";
import { WarningBanner } from "./WarningBanner";
import { CaffeineSection } from "./sections/CaffeineSection";
import { MealSection } from "./sections/MealSection";
import { SupplementSection } from "./sections/SupplementSection";
import { HabitSection } from "./sections/HabitSection";
import { StimulatingSection } from "./sections/StimulatingSection";
import { SexualActivitySection } from "./sections/SexualActivitySection";
import { PreBedRitualSection } from "./sections/PreBedRitualSection";
import { NapSection } from "./sections/NapSection";
import { SunlightSection } from "./sections/SunlightSection";
import { RedLightSection } from "./sections/RedLightSection";
import { NSDRSection } from "./sections/NSDRSection";
import { CaffeineChart } from "../CaffeineChart/CaffeineChart";
import { readTrackedSections } from "../../trackedSections";
import type { SectionKey } from "../../trackedSections";
import "./DailyLogPage.css";

/** Strip id/date from a DailyLogOut to get form data after a copy. */
function outToCreate(out: DailyLogOut): DailyLogCreate {
  return {
    is_sick: out.is_sick,
    notes: out.notes,
    caffeine_entries: out.caffeine_entries.map(
      ({ time, amount_mg, source }) => ({ time, amount_mg, source }),
    ),
    meal_entries: out.meal_entries.map(({ time, is_last_meal, notes }) => ({
      time,
      is_last_meal,
      notes,
    })),
    supplement_entries: out.supplement_entries.map(
      ({ time, name, dose_mg }) => ({ time, name, dose_mg }),
    ),
    habit_entries: out.habit_entries.map(
      ({ habit_type, time, value, duration_minutes, notes }) => ({
        habit_type,
        time,
        value,
        duration_minutes,
        notes,
      }),
    ),
    stimulating_activity_entries: out.stimulating_activity_entries.map(
      ({ end_time, activity_type, duration_minutes }) => ({
        end_time,
        activity_type,
        duration_minutes,
      }),
    ),
    sexual_activity_entry: out.sexual_activity_entry
      ? {
          time: out.sexual_activity_entry.time,
          activity_type: out.sexual_activity_entry.activity_type,
        }
      : null,
    pre_bed_ritual_entries: out.pre_bed_ritual_entries.map(
      ({ time, ritual_type, duration_minutes }) => ({
        time,
        ritual_type,
        duration_minutes,
      }),
    ),
    nap_entries: out.nap_entries.map(
      ({ start_time, end_time, duration_minutes }) => ({
        start_time,
        end_time,
        duration_minutes,
      }),
    ),
    sunlight_entries: out.sunlight_entries.map(
      ({ start_time, duration_minutes, estimated_lux, notes }) => ({
        start_time,
        duration_minutes,
        estimated_lux,
        notes,
      }),
    ),
    red_light_entries: out.red_light_entries.map(
      ({ panel_id, start_time, duration_minutes, distance_inches }) => ({
        panel_id,
        start_time,
        duration_minutes,
        distance_inches,
      }),
    ),
    nsdr_entries: out.nsdr_entries.map(
      ({ time, duration_minutes, nsdr_type }) => ({
        time,
        duration_minutes,
        nsdr_type,
      }),
    ),
  };
}

export function DailyLogPage() {
  const { currentDate, isToday, prev, next, today } = useDateNavigation();
  const {
    formData,
    setFormData,
    warnings,
    setWarnings,
    loading,
    loadError,
    reload,
    saving,
    saveStatus,
    saveError,
    save,
  } = useDailyLog(currentDate);
  const [settings, setSettings] = useState<UserSettingsOut | null>(null);
  // #47: read once per mount — Settings edits land on the next visit here.
  const [tracked] = useState(readTrackedSections);

  // An untracked section still renders when the viewed day holds data in
  // it: hiding recorded entries would be worse than showing an extra
  // section (and the form still submits the full payload either way).
  const visible = (key: SectionKey, hasData: boolean) =>
    tracked.has(key) || hasData;

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  const bedtimeHour = settings?.typical_bedtime
    ? Number(settings.typical_bedtime.split(":")[0]) +
      Number(settings.typical_bedtime.split(":")[1]) / 60
    : null;

  const caffeinePoints = useCaffeineDecay(
    formData.caffeine_entries,
    settings?.caffeine_sensitivity ?? "normal",
    bedtimeHour,
  );

  const update = <K extends keyof DailyLogCreate>(
    key: K,
    value: DailyLogCreate[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleCopied = (log: DailyLogOut) => {
    setFormData(outToCreate(log));
  };

  if (loading) {
    return (
      <div
        style={{
          color: "var(--color-text-muted)",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        Loading...
      </div>
    );
  }

  if (loadError) {
    // No editable form here: saving an empty form over a day whose load
    // failed would overwrite whatever that day already holds.
    return (
      <div className="daily-log-page">
        <DateNavigator
          date={currentDate}
          isToday={isToday}
          onPrev={prev}
          onNext={next}
          onToday={today}
        />
        <div className="daily-log-load-error" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={reload}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="daily-log-page">
      <DateNavigator
        date={currentDate}
        isToday={isToday}
        onPrev={prev}
        onNext={next}
        onToday={today}
      />

      <WarningBanner warnings={warnings} onDismiss={() => setWarnings([])} />

      <div className="daily-log-actions">
        <CopyDayButton targetDate={currentDate} onCopied={handleCopied} />
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.85rem",
              color: "var(--color-text-secondary)",
            }}
          >
            <input
              type="checkbox"
              checked={formData.is_sick ?? false}
              onChange={(e) => update("is_sick", e.target.checked || null)}
            />
            Sick day
          </label>
        </div>
      </div>

      <div className="daily-log-sections">
        {visible("caffeine", formData.caffeine_entries.length > 0) && (
          <CaffeineSection
            entries={formData.caffeine_entries}
            onChange={(v) => update("caffeine_entries", v)}
          />
        )}

        {formData.caffeine_entries.length > 0 && (
          <CaffeineChart points={caffeinePoints} bedtimeHour={bedtimeHour} />
        )}

        {visible("meals", formData.meal_entries.length > 0) && (
          <MealSection
            entries={formData.meal_entries}
            onChange={(v) => update("meal_entries", v)}
          />
        )}

        {visible("supplements", formData.supplement_entries.length > 0) && (
          <SupplementSection
            entries={formData.supplement_entries}
            onChange={(v) => update("supplement_entries", v)}
          />
        )}

        {visible("habits", formData.habit_entries.length > 0) && (
          <HabitSection
            entries={formData.habit_entries}
            onChange={(v) => update("habit_entries", v)}
          />
        )}

        {visible(
          "stimulating",
          formData.stimulating_activity_entries.length > 0,
        ) && (
          <StimulatingSection
            entries={formData.stimulating_activity_entries}
            onChange={(v) => update("stimulating_activity_entries", v)}
          />
        )}

        {visible("sexual", formData.sexual_activity_entry !== null) && (
          <SexualActivitySection
            entry={formData.sexual_activity_entry}
            onChange={(v) => update("sexual_activity_entry", v)}
          />
        )}

        {visible("rituals", formData.pre_bed_ritual_entries.length > 0) && (
          <PreBedRitualSection
            entries={formData.pre_bed_ritual_entries}
            onChange={(v) => update("pre_bed_ritual_entries", v)}
          />
        )}

        {visible("naps", formData.nap_entries.length > 0) && (
          <NapSection
            entries={formData.nap_entries}
            onChange={(v) => update("nap_entries", v)}
          />
        )}

        {visible("sunlight", formData.sunlight_entries.length > 0) && (
          <SunlightSection
            entries={formData.sunlight_entries}
            onChange={(v) => update("sunlight_entries", v)}
          />
        )}

        {visible("redLight", formData.red_light_entries.length > 0) && (
          <RedLightSection
            entries={formData.red_light_entries}
            onChange={(v) => update("red_light_entries", v)}
          />
        )}

        {visible("nsdr", formData.nsdr_entries.length > 0) && (
          <NSDRSection
            entries={formData.nsdr_entries}
            onChange={(v) => update("nsdr_entries", v)}
          />
        )}
      </div>

      <div className="daily-log-notes">
        <label
          style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}
        >
          Notes
        </label>
        <textarea
          value={formData.notes ?? ""}
          onChange={(e) => update("notes", e.target.value || null)}
          placeholder="Any other notes about today..."
          rows={3}
          style={{ width: "100%", resize: "vertical" }}
        />
      </div>

      <div className="daily-log-save">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="daily-log-save-btn"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {saveStatus === "saved" && (
          <span className="daily-log-save-ok" role="status">
            Saved ✓
          </span>
        )}
        {saveStatus === "error" && saveError && (
          <span className="daily-log-save-error" role="alert">
            {saveError}
          </span>
        )}
      </div>
    </div>
  );
}
