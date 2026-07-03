/** Backend enums mirrored as TS const objects for runtime + compile-time use. */

export const CaffeineSource = {
  ESPRESSO: "espresso",
  DRIP_COFFEE: "drip_coffee",
  COLD_BREW: "cold_brew",
  TEA: "tea",
  ENERGY_DRINK: "energy_drink",
  SODA: "soda",
  SUPPLEMENT: "supplement",
  OTHER: "other",
} as const;
export type CaffeineSource =
  (typeof CaffeineSource)[keyof typeof CaffeineSource];

export const CAFFEINE_SOURCE_LABELS: Record<CaffeineSource, string> = {
  espresso: "Espresso",
  drip_coffee: "Drip Coffee",
  cold_brew: "Cold Brew",
  tea: "Tea",
  energy_drink: "Energy Drink",
  soda: "Soda",
  supplement: "Supplement",
  other: "Other",
};

export const HabitType = {
  BLUE_BLOCKERS_ON: "blue_blockers_on",
  SCREENS_OFF: "screens_off",
  EXERCISE: "exercise",
  ALCOHOL: "alcohol",
  ROOM_TEMP_F: "room_temp_f",
  STRESS_LEVEL: "stress_level",
  SAUNA: "sauna",
  WARM_SHOWER: "warm_shower",
} as const;
export type HabitType = (typeof HabitType)[keyof typeof HabitType];

export const HABIT_TYPE_LABELS: Record<HabitType, string> = {
  blue_blockers_on: "Blue Blockers On",
  screens_off: "Screens Off",
  exercise: "Exercise",
  alcohol: "Alcohol",
  room_temp_f: "Room Temp (F)",
  stress_level: "Stress Level",
  sauna: "Sauna",
  warm_shower: "Warm Shower",
};

export const ExerciseIntensity = {
  LIGHT: "light",
  MODERATE: "moderate",
  INTENSE: "intense",
} as const;
export type ExerciseIntensity =
  (typeof ExerciseIntensity)[keyof typeof ExerciseIntensity];

export const StimulatingActivityType = {
  TV_MOVIES: "tv_movies",
  VIDEO_GAMES: "video_games",
  GRIPPING_AUDIOBOOK: "gripping_audiobook",
  OTHER: "other",
} as const;
export type StimulatingActivityType =
  (typeof StimulatingActivityType)[keyof typeof StimulatingActivityType];

export const STIMULATING_ACTIVITY_LABELS: Record<
  StimulatingActivityType,
  string
> = {
  tv_movies: "TV / Movies",
  video_games: "Video Games",
  gripping_audiobook: "Gripping Audiobook",
  other: "Other",
};

export const SexualActivityType = {
  PARTNERED: "partnered",
  SOLO_WITH_CONTENT: "solo_with_content",
  SOLO_WITHOUT_CONTENT: "solo_without_content",
} as const;
export type SexualActivityType =
  (typeof SexualActivityType)[keyof typeof SexualActivityType];

export const SEXUAL_ACTIVITY_LABELS: Record<SexualActivityType, string> = {
  partnered: "Partnered",
  solo_with_content: "Solo (with content)",
  solo_without_content: "Solo (without content)",
};

export const PreBedRitualType = {
  DEEP_BREATHING: "deep_breathing",
  LEGS_UP_WALL: "legs_up_wall",
  STRETCHING: "stretching",
  JOURNALING: "journaling",
  READING_FICTION: "reading_fiction",
  OTHER: "other",
} as const;
export type PreBedRitualType =
  (typeof PreBedRitualType)[keyof typeof PreBedRitualType];

export const PRE_BED_RITUAL_LABELS: Record<PreBedRitualType, string> = {
  deep_breathing: "Deep Breathing",
  legs_up_wall: "Legs Up Wall",
  stretching: "Stretching",
  journaling: "Journaling",
  reading_fiction: "Reading Fiction",
  other: "Other",
};

export const NSDRType = {
  YOGA_NIDRA: "yoga_nidra",
  BODY_SCAN: "body_scan",
  SLEEP_HYPNOSIS: "sleep_hypnosis",
  GUIDED_RELAXATION: "guided_relaxation",
  OTHER: "other",
} as const;
export type NSDRType = (typeof NSDRType)[keyof typeof NSDRType];

export const NSDR_TYPE_LABELS: Record<NSDRType, string> = {
  yoga_nidra: "Yoga Nidra",
  body_scan: "Body Scan",
  sleep_hypnosis: "Sleep Hypnosis",
  guided_relaxation: "Guided Relaxation",
  other: "Other",
};

export const CaffeineSensitivity = {
  FAST: "fast",
  NORMAL: "normal",
  SLOW: "slow",
} as const;
export type CaffeineSensitivity =
  (typeof CaffeineSensitivity)[keyof typeof CaffeineSensitivity];

export const CAFFEINE_SENSITIVITY_LABELS: Record<CaffeineSensitivity, string> =
  {
    fast: "Fast — evening coffee doesn't keep me up (2.5h half-life)",
    normal: "Normal — afternoon coffee is fine, evening isn't (4h half-life)",
    slow: "Slow — coffee after noon keeps me up (6h half-life)",
  };

export const Chronotype = {
  EARLY: "early",
  INTERMEDIATE: "intermediate",
  LATE: "late",
} as const;
export type Chronotype = (typeof Chronotype)[keyof typeof Chronotype];

export const CHRONOTYPE_LABELS: Record<Chronotype, string> = {
  early: "Early Bird",
  intermediate: "Intermediate",
  late: "Night Owl",
};

export const DisplayMode = {
  CIRCADIAN: "circadian",
  LIGHT: "light",
  AUTO: "auto",
} as const;
export type DisplayMode = (typeof DisplayMode)[keyof typeof DisplayMode];
