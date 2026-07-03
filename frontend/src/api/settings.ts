/** API functions for user settings endpoints. */

import { fetchJson } from "./client";
import type { UserSettingsOut, UserSettingsUpdate } from "../types";

export function getSettings(): Promise<UserSettingsOut> {
  return fetchJson<UserSettingsOut>("/api/settings");
}

export function updateSettings(
  data: UserSettingsUpdate,
): Promise<UserSettingsOut> {
  return fetchJson<UserSettingsOut>("/api/settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
