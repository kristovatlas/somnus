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

/** Intl returns only canonical zones (~418) while the backend accepts the
 * full IANA set incl. link names (~599). Legacy aliases (US/Pacific, …)
 * stay unoffered on purpose — each has a canonical equivalent, and a stored
 * alias survives via the prepend in timezoneOptions. "UTC" is the one zone
 * people genuinely want that some ICU builds omit, so it's guaranteed. */
function withUtc(zones: readonly string[]): readonly string[] {
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

export const ALL_TIMEZONES: readonly string[] = withUtc(
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : CURATED_TIMEZONES,
);

/** Options for a select bound to `current`: a stored value the runtime
 * doesn't know (legacy free-text typo) is prepended so the select still
 * shows the truth and the user can correct it. */
export function timezoneOptions(current: string): string[] {
  return ALL_TIMEZONES.includes(current)
    ? [...ALL_TIMEZONES]
    : [current, ...ALL_TIMEZONES];
}
