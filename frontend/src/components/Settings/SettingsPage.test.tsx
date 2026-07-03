import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SettingsPage } from "./SettingsPage";

const mockSettings = {
  oura_token_set: false,
  typical_bedtime: "22:30:00",
  target_wake_time: "06:30:00",
  caffeine_sensitivity: "normal",
  timezone: "America/New_York",
  chronotype: "intermediate",
  zip_code: null,
  age: 30,
  display_mode: "circadian",
  circadian_mode_start: "20:00:00",
  onboarding_completed: true,
  last_oura_sync: null,
};

function mockFetch() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    if (urlStr === "/api/settings") {
      return new Response(JSON.stringify(mockSettings));
    }
    if (urlStr === "/api/red-light-panels") {
      return new Response(JSON.stringify([]));
    }
    return new Response(JSON.stringify({}), { status: 404 });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/settings"]}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all four sections", async () => {
    mockFetch();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
    expect(screen.getByText("Oura Ring")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Red Light Panels")).toBeInTheDocument();
    expect(screen.getByText("Display")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Loading settings...")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load settings/)).toBeInTheDocument();
    });
  });

  it('shows "Not connected" when no oura token', async () => {
    mockFetch();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Not connected")).toBeInTheDocument();
    });
  });

  it('shows "Connected" when oura token is set', async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr === "/api/settings") {
        return new Response(
          JSON.stringify({
            ...mockSettings,
            oura_token_set: true,
            last_oura_sync: "2026-02-15T12:00:00Z",
          }),
        );
      }
      if (urlStr === "/api/red-light-panels") {
        return new Response(JSON.stringify([]));
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });
    expect(screen.getByText("Sync Now")).toBeInTheDocument();
    expect(screen.getByText("Remove Token")).toBeInTheDocument();
  });
});
