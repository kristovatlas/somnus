/**
 * Display-theme wiring (#46, ADR 004).
 *
 * themes.css defines the palettes as CSS variables under
 * `body.theme-circadian` / `body.theme-light` (with `:root` aliased to
 * circadian as the pre-load default). This module is the single place that
 * decides which class the <body> carries.
 *
 * Auto mode: ADR 004 specifies only a *start* time ("user-configured time,
 * default 8 PM"). The morning switch-back uses the user's target wake time —
 * mornings begin when the user intends to be awake — falling back to 06:30
 * when unset.
 */
import type { UserSettingsOut } from "./types";
import { DisplayMode } from "./types";

export type EffectiveTheme = "circadian" | "light";

const FALLBACK_WAKE = "06:30:00";

/** "HH:MM" or "HH:MM:SS" → minutes since midnight; null if unparseable.
 * Number.isInteger rejects NaN and undefined in one check (a bare "20"
 * would otherwise yield NaN that poisons every later comparison). */
function toMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function computeEffectiveTheme(
  mode: UserSettingsOut["display_mode"],
  circadianStart: string | null | undefined,
  targetWakeTime: string | null | undefined,
  now: Date,
): EffectiveTheme {
  if (mode === DisplayMode.LIGHT) return "light";
  if (mode === DisplayMode.CIRCADIAN) return "circadian";
  // Auto: circadian during the overnight window [start, wake), light otherwise.
  const start = toMinutes(circadianStart) ?? toMinutes("20:00:00");
  const wake = toMinutes(targetWakeTime) ?? toMinutes(FALLBACK_WAKE);
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (start === null || wake === null) return "circadian";
  if (start === wake) return "circadian"; // degenerate window: stay safe
  const inOvernightWindow =
    start > wake
      ? minutes >= start || minutes < wake // window crosses midnight (normal)
      : minutes >= start && minutes < wake; // window within one day
  return inOvernightWindow ? "circadian" : "light";
}

export function applyTheme(theme: EffectiveTheme): void {
  document.body.classList.toggle("theme-circadian", theme === "circadian");
  document.body.classList.toggle("theme-light", theme === "light");
}

/** The freshest settings ever applied. Layout's periodic re-tick reads
 * this instead of its own fetch-time snapshot: useSettings.update() runs
 * through applyThemeFromSettings on every PATCH, so a stale Layout closure
 * can never revert a just-changed theme. */
let lastApplied: UserSettingsOut | null = null;

export function applyThemeFromSettings(
  settings: UserSettingsOut,
  now: Date = new Date(),
): EffectiveTheme {
  lastApplied = settings;
  const theme = computeEffectiveTheme(
    settings.display_mode,
    settings.circadian_mode_start,
    settings.target_wake_time,
    now,
  );
  applyTheme(theme);
  return theme;
}

/** Re-evaluate Auto mode's clock window against the freshest settings. */
export function reapplyTheme(now: Date = new Date()): void {
  if (lastApplied) applyThemeFromSettings(lastApplied, now);
}
