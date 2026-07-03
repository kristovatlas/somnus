/** API functions for Oura Ring sync endpoint. */

import { fetchJson } from "./client";
import type { OuraSyncResponse } from "../types";

export function syncOura(
  startDate?: string,
  endDate?: string,
): Promise<OuraSyncResponse> {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString();
  return fetchJson<OuraSyncResponse>(`/api/oura/sync${qs ? `?${qs}` : ""}`);
}
