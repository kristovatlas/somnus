/** Reports API — weekly/monthly summaries. */

import { fetchJson } from "./client";
import type { WeeklyReport, MonthlyReport } from "../types";

export function getWeeklyReport(
  year?: number,
  week?: number,
): Promise<WeeklyReport> {
  const params = new URLSearchParams();
  if (year !== undefined) params.set("year", String(year));
  if (week !== undefined) params.set("week", String(week));
  const qs = params.toString();
  return fetchJson<WeeklyReport>(`/api/reports/weekly${qs ? `?${qs}` : ""}`);
}

export function getMonthlyReport(
  year?: number,
  month?: number,
): Promise<MonthlyReport> {
  const params = new URLSearchParams();
  if (year !== undefined) params.set("year", String(year));
  if (month !== undefined) params.set("month", String(month));
  const qs = params.toString();
  return fetchJson<MonthlyReport>(`/api/reports/monthly${qs ? `?${qs}` : ""}`);
}

export function weeklyExportUrl(year?: number, week?: number): string {
  const params = new URLSearchParams();
  if (year !== undefined) params.set("year", String(year));
  if (week !== undefined) params.set("week", String(week));
  const qs = params.toString();
  return `/api/reports/weekly/export-html${qs ? `?${qs}` : ""}`;
}

export function monthlyExportUrl(year?: number, month?: number): string {
  const params = new URLSearchParams();
  if (year !== undefined) params.set("year", String(year));
  if (month !== undefined) params.set("month", String(month));
  const qs = params.toString();
  return `/api/reports/monthly/export-html${qs ? `?${qs}` : ""}`;
}
