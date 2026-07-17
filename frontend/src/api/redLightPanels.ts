/** API functions for red light panel endpoints. */

import { fetchJson } from "./client";

export interface RedLightPanelOut {
  id: number;
  name: string;
  wavelength_nm: number | null;
  irradiance_mw_cm2: number | null;
  default_distance_inches: number | null;
  notes: string | null;
}

export interface RedLightPanelCreate {
  name: string;
  wavelength_nm?: number | null;
  irradiance_mw_cm2?: number | null;
  default_distance_inches?: number | null;
  notes?: string | null;
}

export function listPanels(): Promise<RedLightPanelOut[]> {
  return fetchJson<RedLightPanelOut[]>("/api/red-light-panels");
}

export function createPanel(
  data: RedLightPanelCreate,
): Promise<RedLightPanelOut> {
  return fetchJson<RedLightPanelOut>("/api/red-light-panels", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePanel(
  id: number,
  data: RedLightPanelCreate,
): Promise<RedLightPanelOut> {
  return fetchJson<RedLightPanelOut>(`/api/red-light-panels/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
