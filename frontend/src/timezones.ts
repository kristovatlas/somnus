/**
 * Timezone lists (#50) — single source for every timezone selector.
 *
 * The full list comes from the browser's own IANA database
 * (Intl.supportedValuesOf), so the UI can never offer a zone the runtime
 * doesn't know; the curated subset keeps onboarding friendly. The backend
 * independently validates against Python's zoneinfo (the authority).
 */

export const CURATED_TIMEZONES = [
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

export const CURATED_TIMEZONE_LABELS: Record<string, string> = {
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

export const ALL_TIMEZONES: readonly string[] =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : CURATED_TIMEZONES;

/** Options for a select bound to `current`: a stored value the runtime
 * doesn't know (legacy free-text typo) is prepended so the select still
 * shows the truth and the user can correct it. */
export function timezoneOptions(current: string): string[] {
  return ALL_TIMEZONES.includes(current)
    ? [...ALL_TIMEZONES]
    : [current, ...ALL_TIMEZONES];
}
