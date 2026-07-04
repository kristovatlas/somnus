import { useCallback, useEffect, useState } from "react";
import { getDailyLog, saveDailyLog } from "../api/dailyLog";
import type { DailyLogCreate, DailyLogOut } from "../types";
import { ApiError } from "../types/api";

function emptyLog(): DailyLogCreate {
  return {
    is_sick: null,
    notes: null,
    caffeine_entries: [],
    meal_entries: [],
    supplement_entries: [],
    habit_entries: [],
    stimulating_activity_entries: [],
    sexual_activity_entry: null,
    pre_bed_ritual_entries: [],
    nap_entries: [],
    sunlight_entries: [],
    red_light_entries: [],
    nsdr_entries: [],
  };
}

/** Strip `id` and `date` from Out entries to produce Create form state. */
function outToCreate(out: DailyLogOut): DailyLogCreate {
  return {
    is_sick: out.is_sick,
    notes: out.notes,
    caffeine_entries: out.caffeine_entries.map(
      ({ time, amount_mg, source }) => ({
        time,
        amount_mg,
        source,
      }),
    ),
    meal_entries: out.meal_entries.map(({ time, is_last_meal, notes }) => ({
      time,
      is_last_meal,
      notes,
    })),
    supplement_entries: out.supplement_entries.map(
      ({ time, name, dose_mg }) => ({
        time,
        name,
        dose_mg,
      }),
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
      ({ panel_id, start_time, duration_minutes }) => ({
        panel_id,
        start_time,
        duration_minutes,
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

export function useDailyLog(date: string) {
  const [formData, setFormData] = useState<DailyLogCreate>(emptyLog);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    setLoading(true);
    setWarnings([]);
    getDailyLog(date)
      .then((out) => {
        setFormData(outToCreate(out));
        setExists(true);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) {
          setFormData(emptyLog());
          setExists(false);
        }
      })
      .finally(() => setLoading(false));
  }, [date]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await saveDailyLog(date, formData);
      setFormData(outToCreate(res.data));
      setWarnings(res.warnings);
      setExists(true);
      return res;
    } finally {
      setSaving(false);
    }
  }, [date, formData]);

  return {
    formData,
    setFormData,
    warnings,
    setWarnings,
    loading,
    saving,
    exists,
    save,
  };
}
