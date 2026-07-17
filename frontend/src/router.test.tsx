import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { Layout } from "./components/Layout/Layout";
import { OnboardingWizard } from "./components/Onboarding/OnboardingWizard";
import { DailyLogPage } from "./components/DailyLog/DailyLogPage";
import {
  NotFoundPage,
  RouteErrorPage,
} from "./components/Layout/RouteFallbacks";
import { resetLaunchSyncGuard } from "./launchSync";

const mockSettingsOnboarded = {
  oura_token_set: false,
  typical_bedtime: null,
  target_wake_time: null,
  caffeine_sensitivity: "normal",
  timezone: "America/New_York",
  chronotype: null,
  zip_code: null,
  age: null,
  display_mode: "circadian",
  circadian_mode_start: "20:00:00",
  onboarding_completed: true,
};

const mockSettingsNotOnboarded = {
  ...mockSettingsOnboarded,
  onboarding_completed: false,
};

function ThrowingPage(): never {
  throw new Error("boom from render");
}

function createRouter(initialPath: string) {
  // Mirrors the real router's shape (#51: errorElement + catch-all included)
  return createMemoryRouter(
    [
      {
        path: "/",
        element: <Layout />,
        errorElement: <RouteErrorPage />,
        children: [
          { path: "onboarding", element: <OnboardingWizard /> },
          { path: "log/:date", element: <DailyLogPage /> },
          { path: "explodes", element: <ThrowingPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
}

describe("Router guard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("redirects to onboarding when not completed", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/settings")) {
        return new Response(JSON.stringify(mockSettingsNotOnboarded));
      }
      return new Response(JSON.stringify({ detail: "Not found" }), {
        status: 404,
      });
    });

    const router = createRouter("/log/2024-01-01");
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText("Welcome to Somnus")).toBeInTheDocument();
    });
  });

  it("redirects to log when onboarding completed and on /onboarding", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/settings")) {
        return new Response(JSON.stringify(mockSettingsOnboarded));
      }
      if (urlStr.includes("/api/daily-log/")) {
        return new Response(JSON.stringify({ detail: "Not found" }), {
          status: 404,
        });
      }
      if (urlStr.includes("/api/red-light-panels")) {
        return new Response(JSON.stringify([]));
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    const router = createRouter("/onboarding");
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      // Should redirect away from onboarding - should see daily log page elements
      expect(screen.queryByText("Welcome to Somnus")).not.toBeInTheDocument();
    });
  });

  it("shows layout header", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/settings")) {
        return new Response(JSON.stringify(mockSettingsOnboarded));
      }
      if (urlStr.includes("/api/daily-log/")) {
        return new Response(JSON.stringify({ detail: "Not found" }), {
          status: 404,
        });
      }
      if (urlStr.includes("/api/red-light-panels")) {
        return new Response(JSON.stringify([]));
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    const router = createRouter("/log/2024-01-01");
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText("Somnus")).toBeInTheDocument();
    });
  });

  // --- #51: router hardening ---

  it("unknown URLs render the not-found page inside the app chrome", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify(mockSettingsOnboarded)),
    );
    render(<RouterProvider router={createRouter("/no/such/page")} />);
    expect(await screen.findByText("Page not found")).toBeInTheDocument();
    expect(screen.getByText("Go to today's log")).toBeInTheDocument();
  });

  it("a render error shows the recovery page, not a white screen", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify(mockSettingsOnboarded)),
    );
    vi.spyOn(console, "error").mockImplementation(() => {}); // router logs the throw
    render(<RouterProvider router={createRouter("/explodes")} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong",
    );
    expect(screen.getByText("boom from render")).toBeInTheDocument();
    expect(screen.getByText("Reload")).toBeInTheDocument();
  });

  it("backend down shows the shell-level unreachable banner with retry", async () => {
    let fail = true;
    // Only the settings fetch fails: failing everything would ALSO raise the
    // Daily Log's own load-error Retry panel (#79) and make "Retry" ambiguous.
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/settings")) {
        if (fail) throw new TypeError("fetch failed");
        return new Response(JSON.stringify(mockSettingsOnboarded));
      }
      return new Response(JSON.stringify({ detail: "Not found" }), {
        status: 404,
      });
    });
    const { getByText } = render(
      <RouterProvider router={createRouter("/log/2024-06-15")} />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Backend not reachable",
    );

    fail = false;
    getByText("Retry").click();
    await waitFor(() => {
      expect(
        screen.queryByText(/Backend not reachable/),
      ).not.toBeInTheDocument();
    });
  });

  // --- #57: launch auto-sync indicator gating ---

  it("renders the sync chip only when an Oura token is set", async () => {
    resetLaunchSyncGuard();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/settings")) {
        return new Response(
          JSON.stringify({ ...mockSettingsOnboarded, oura_token_set: true }),
        );
      }
      if (urlStr.includes("/api/oura/sync") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            synced_count: 2,
            start_date: "2026-07-01",
            end_date: "2026-07-16",
            errors: [],
          }),
        );
      }
      return new Response(JSON.stringify({ detail: "Not found" }), {
        status: 404,
      });
    });
    render(<RouterProvider router={createRouter("/log/2024-06-15")} />);
    expect(await screen.findByText("Oura synced · 2 new")).toBeInTheDocument();
  });

  it("no token, no chip, no sync request", async () => {
    resetLaunchSyncGuard();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/settings")) {
        return new Response(JSON.stringify(mockSettingsOnboarded));
      }
      return new Response(JSON.stringify({ detail: "Not found" }), {
        status: 404,
      });
    });
    render(<RouterProvider router={createRouter("/log/2024-06-15")} />);
    await waitFor(() => {
      expect(screen.queryByText(/Syncing Oura/)).not.toBeInTheDocument();
    });
    const syncCalls = vi
      .mocked(globalThis.fetch)
      .mock.calls.filter(([url]) => String(url).includes("/api/oura/sync"));
    expect(syncCalls).toHaveLength(0);
  });
});
