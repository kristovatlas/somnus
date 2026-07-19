/** API functions for daily log endpoints. */

import { fetchJson, fetchVoid } from "./client";
import type {
  DailyLogCreate,
  DailyLogOut,
  DailyLogResponse,
  DailyLogSummary,
} from "../types";

export function getDailyLog(date: string): Promise<DailyLogOut> {
  return fetchJson<DailyLogOut>(`/api/daily-log/${date}`);
}

export function saveDailyLog(
  date: string,
  data: DailyLogCreate,
): Promise<DailyLogResponse> {
  return fetchJson<DailyLogResponse>(`/api/daily-log/${date}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function listDailyLogs(
  startDate?: string,
  endDate?: string,
): Promise<DailyLogSummary[]> {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString();
  return fetchJson<DailyLogSummary[]>(`/api/daily-log${qs ? `?${qs}` : ""}`);
}

export function copyDay(
  targetDate: string,
  sourceDate: string,
): Promise<DailyLogOut> {
  return fetchJson<DailyLogOut>(
    `/api/daily-log/${targetDate}/copy-from/${sourceDate}`,
    {
      method: "POST",
    },
  );
}

export function deleteDailyLog(date: string): Promise<void> {
  return fetchVoid(`/api/daily-log/${date}`, { method: "DELETE" });
}
