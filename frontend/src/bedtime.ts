/** #58: pure bedtime-countdown computation — see BedtimeCountdown.tsx
 * for the card. Separate module so the component file only exports
 * components (react-refresh rule), mirroring theme.ts. */

export interface BedtimeStatus {
  label: string;
  detail: string;
}

const PAST_WINDOW_HOURS = 3;

function fmtDelta(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtClock(hourFrac: number): string {
  const h = Math.floor(hourFrac) % 24;
  const m = Math.round((hourFrac - Math.floor(hourFrac)) * 60);
  const hh = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** "HH:MM[:SS]" → fractional hour, or null. */
export function parseTime(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h + m / 60;
}

export function computeBedtimeStatus(
  startHour: number,
  endHour: number | null,
  source: "optimal" | "typical",
  now: Date,
): BedtimeStatus {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = Math.round(startHour * 60) % 1440;
  const endMin = endHour === null ? startMin : Math.round(endHour * 60) % 1440;
  const windowLen = (endMin - startMin + 1440) % 1440;
  const sinceStart = (nowMin - startMin + 1440) % 1440;

  const sourceLabel =
    source === "optimal"
      ? `optimal window ${fmtClock(startHour)}–${fmtClock(endHour ?? startHour)}`
      : `typical bedtime ${fmtClock(startHour)}`;

  if (sinceStart <= windowLen) {
    return {
      label: source === "optimal" ? "Bedtime window is open" : "It's bedtime",
      detail: sourceLabel,
    };
  }
  const sinceEnd = (nowMin - endMin + 1440) % 1440;
  if (sinceEnd <= PAST_WINDOW_HOURS * 60) {
    return {
      label: `Past bedtime by ${fmtDelta(sinceEnd)}`,
      detail: sourceLabel,
    };
  }
  const untilStart = (startMin - nowMin + 1440) % 1440;
  return {
    label: `Bedtime in ${fmtDelta(untilStart)}`,
    detail: sourceLabel,
  };
}
