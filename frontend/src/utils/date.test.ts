import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  formatDate,
  isToday,
  parseDateStr,
  toDateStr,
  todayStr,
} from "./date";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("parseDateStr", () => {
  it("parses to local midnight of the named day", () => {
    const d = parseDateStr("2026-07-04");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([
      2026, 6, 4, 0,
    ]);
  });
});

describe("toDateStr", () => {
  it("zero-pads month and day", () => {
    expect(toDateStr(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("addDays", () => {
  it("shifts within a month", () => {
    expect(addDays("2026-07-04", 1)).toBe("2026-07-05");
    expect(addDays("2026-07-04", -1)).toBe("2026-07-03");
  });

  it("rolls over month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("handles leap days", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("shifts the local day even where UTC is a different day (UTC+14)", () => {
    // Regression: toISOString()-based shifting returned the SAME date here.
    vi.stubEnv("TZ", "Pacific/Kiritimati");
    expect(addDays("2026-07-04", 1)).toBe("2026-07-05");
    expect(addDays("2026-07-04", -1)).toBe("2026-07-03");
  });
});

describe("todayStr / isToday", () => {
  it("reflects the local calendar day, not UTC", () => {
    vi.stubEnv("TZ", "Pacific/Kiritimati"); // UTC+14: local day rolls over first
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T20:00:00Z")); // 10:00 Jul 5 local
    expect(todayStr()).toBe("2026-07-05");
    expect(isToday("2026-07-05")).toBe(true);
    expect(isToday("2026-07-04")).toBe(false);
  });
});

describe("formatDate", () => {
  it("formats the named day, immune to timezone shifts", () => {
    vi.stubEnv("TZ", "Pacific/Kiritimati");
    const formatted = formatDate("2026-07-04", {
      month: "short",
      day: "numeric",
    });
    expect(formatted).toMatch(/Jul/);
    expect(formatted).toContain("4");
  });
});
