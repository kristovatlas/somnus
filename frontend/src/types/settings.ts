/** TypeScript interfaces mirroring backend UserSettings schemas. */

import type { CaffeineSensitivity, Chronotype, DisplayMode } from './enums'

export interface UserSettingsOut {
  oura_token_set: boolean
  typical_bedtime: string | null
  target_wake_time: string | null
  caffeine_sensitivity: CaffeineSensitivity
  timezone: string
  chronotype: Chronotype | null
  zip_code: string | null
  age: number | null
  display_mode: DisplayMode
  circadian_mode_start: string
  onboarding_completed: boolean
  last_oura_sync: string | null
}

export interface OuraSyncResponse {
  synced_count: number
  start_date: string
  end_date: string
  errors: string[]
}

export interface UserSettingsUpdate {
  oura_token?: string | null
  typical_bedtime?: string | null
  target_wake_time?: string | null
  caffeine_sensitivity?: CaffeineSensitivity
  timezone?: string
  chronotype?: Chronotype | null
  zip_code?: string | null
  age?: number | null
  display_mode?: DisplayMode
  circadian_mode_start?: string
  onboarding_completed?: boolean
}
