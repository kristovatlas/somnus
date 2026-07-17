import { describe, it, expect, beforeEach } from "vitest";
import {
  applyTheme,
  applyThemeFromSettings,
  computeEffectiveTheme,
} from "./theme";
import { DisplayMode } from "./types";
import type { UserSettingsOut } from "./types";

function at(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2026, 6, 15, h, m);
}

describe("computeEffectiveTheme", () => {
  it("fixed modes ignore the clock", () => {
    expect(
      computeEffectiveTheme(
        DisplayMode.CIRCADIAN,
        "20:00:00",
        "06:30:00",
        at("12:00"),
      ),
    ).toBe("circadian");
    expect(
      computeEffectiveTheme(
        DisplayMode.LIGHT,
        "20:00:00",
        "06:30:00",
        at("23:00"),
      ),
    ).toBe("light");
  });

  it("auto is circadian from start until wake, light in between", () => {
    const auto = (now: string) =>
      computeEffectiveTheme(DisplayMode.AUTO, "20:00:00", "06:30:00", at(now));
    expect(auto("19:59")).toBe("light");
    expect(auto("20:00")).toBe("circadian"); // start boundary inclusive
    expect(auto("23:30")).toBe("circadian");
    expect(auto("03:00")).toBe("circadian"); // past midnight
    expect(auto("06:29")).toBe("circadian");
    expect(auto("06:30")).toBe("light"); // wake boundary exclusive
    expect(auto("12:00")).toBe("light");
  });

  it("auto handles a same-day window (start before wake)", () => {
    // Unusual but representable: circadian 01:00 → wake 09:00
    const auto = (now: string) =>
      computeEffectiveTheme(DisplayMode.AUTO, "01:00:00", "09:00:00", at(now));
    expect(auto("00:30")).toBe("light");
    expect(auto("05:00")).toBe("circadian");
    expect(auto("10:00")).toBe("light");
  });

  it("auto falls back to defaults on missing or malformed times", () => {
    expect(
      computeEffectiveTheme(DisplayMode.AUTO, null, null, at("21:00")),
    ).toBe("circadian"); // defaults 20:00 → 06:30
    expect(
      computeEffectiveTheme(DisplayMode.AUTO, "not-a-time", null, at("21:00")),
    ).toBe("circadian");
    expect(
      computeEffectiveTheme(DisplayMode.AUTO, null, null, at("12:00")),
    ).toBe("light");
  });

  it("degenerate equal start/wake stays circadian (the safe palette)", () => {
    expect(
      computeEffectiveTheme(
        DisplayMode.AUTO,
        "07:00:00",
        "07:00:00",
        at("12:00"),
      ),
    ).toBe("circadian");
  });
});

describe("applyTheme", () => {
  beforeEach(() => {
    document.body.className = "";
  });

  it("sets exactly one theme class and swaps cleanly", () => {
    applyTheme("light");
    expect(document.body.classList.contains("theme-light")).toBe(true);
    expect(document.body.classList.contains("theme-circadian")).toBe(false);

    applyTheme("circadian");
    expect(document.body.classList.contains("theme-circadian")).toBe(true);
    expect(document.body.classList.contains("theme-light")).toBe(false);
  });

  it("applyThemeFromSettings wires settings through", () => {
    const settings = {
      display_mode: DisplayMode.LIGHT,
      circadian_mode_start: "20:00:00",
      target_wake_time: "06:30:00",
    } as UserSettingsOut;
    expect(applyThemeFromSettings(settings, at("22:00"))).toBe("light");
    expect(document.body.classList.contains("theme-light")).toBe(true);
  });
});
