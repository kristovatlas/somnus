/**
 * Tracked-sections selection (#47).
 *
 * The onboarding Tracking Setup step and the Settings editor both write the
 * user's choice of Daily Log sections here; the Daily Log hides sections
 * that are untracked — unless a day already holds data in one, which always
 * renders (hiding recorded data would be worse than an extra section).
 *
 * Stored in localStorage (device-scoped, like the section open/closed
 * state). The pre-#47 key stored 12 pseudo-items that didn't match real
 * sections (exercise/stress/alcohol/screens are habit *types*); reads
 * migrate those transparently.
 */

export const TRACKED_SECTIONS = [
  { key: "caffeine", label: "Caffeine" },
  { key: "meals", label: "Meals" },
  { key: "supplements", label: "Supplements" },
  { key: "habits", label: "Habits (exercise, alcohol, screens, stress)" },
  { key: "stimulating", label: "Stimulating activities" },
  { key: "sexual", label: "Sexual activity" },
  { key: "rituals", label: "Pre-bed rituals" },
  { key: "naps", label: "Naps" },
  { key: "sunlight", label: "Sunlight exposure" },
  { key: "redLight", label: "Red light therapy" },
  { key: "nsdr", label: "NSDR / Yoga Nidra" },
] as const;

export type SectionKey = (typeof TRACKED_SECTIONS)[number]["key"];

const STORAGE_KEY = "somnus-tracked-sections";

const ALL_KEYS: readonly SectionKey[] = TRACKED_SECTIONS.map((s) => s.key);

/** Pre-#47 pseudo-item keys → real section keys. */
const LEGACY_KEY_MAP: Record<string, SectionKey> = {
  exercise: "habits",
  stress: "habits",
  alcohol: "habits",
  screens: "habits",
};

/** Sections the legacy step never offered — always tracked after migration
 * (the user was never given the chance to turn them off). */
const LEGACY_ABSENT: readonly SectionKey[] = ["stimulating", "sexual"];

function isSectionKey(key: string): key is SectionKey {
  return (ALL_KEYS as readonly string[]).includes(key);
}

export function readTrackedSections(): Set<SectionKey> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return new Set(ALL_KEYS);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return new Set(ALL_KEYS);
  }
  if (!Array.isArray(parsed)) return new Set(ALL_KEYS);

  const keys = parsed.filter((k): k is string => typeof k === "string");
  const result = new Set<SectionKey>();
  let sawLegacyKey = false;
  for (const key of keys) {
    if (key in LEGACY_KEY_MAP) {
      sawLegacyKey = true;
      result.add(LEGACY_KEY_MAP[key]);
    } else if (isSectionKey(key)) {
      result.add(key);
    }
  }
  if (sawLegacyKey) {
    for (const key of LEGACY_ABSENT) result.add(key);
  }
  return result;
}

export function writeTrackedSections(sections: Set<SectionKey>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...sections]));
}
