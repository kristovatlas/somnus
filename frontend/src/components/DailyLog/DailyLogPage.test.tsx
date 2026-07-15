import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DailyLogPage } from "./DailyLogPage";

const mockLogOut = {
  date: "2024-06-15",
  copied_from_date: null,
  is_sick: null,
  notes: null,
  caffeine_entries: [],
  meal_entries: [],
  supplement_entries: [],
  habit_entries: [],
  stimulating_activity_entries: [],
  sexual_activity_entry: null,
  pre_bed_ritual_entries: [],
  nap_entries: [],
  sunlight_entries: [],
  red_light_entries: [],
  nsdr_entries: [],
};

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
};

function mockFetch() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    if (urlStr.includes("/api/settings")) {
      return new Response(JSON.stringify(mockSettings));
    }
    if (
      urlStr.includes("/api/daily-log/") &&
      (!init || !init.method || init.method === "GET")
    ) {
      return new Response(JSON.stringify(mockLogOut));
    }
    if (urlStr.includes("/api/daily-log/") && init?.method === "PUT") {
      return new Response(JSON.stringify({ data: mockLogOut, warnings: [] }));
    }
    if (urlStr.includes("/api/red-light-panels")) {
      return new Response(JSON.stringify([]));
    }
    return new Response(JSON.stringify({ detail: "Not found" }), {
      status: 404,
    });
  });
}

function renderPage(date = "2024-06-15") {
  return render(
    <MemoryRouter initialEntries={[`/log/${date}`]}>
      <Routes>
        <Route path="/log/:date" element={<DailyLogPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DailyLogPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("renders date navigator", async () => {
    mockFetch();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Jun/)).toBeInTheDocument();
    });
  });

  it("renders section headers", async () => {
    mockFetch();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Caffeine")).toBeInTheDocument();
    });
    expect(screen.getByText("Meals")).toBeInTheDocument();
    expect(screen.getByText("Supplements")).toBeInTheDocument();
    expect(screen.getByText("Habits")).toBeInTheDocument();
  });

  it("shows save button", async () => {
    mockFetch();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Save")).toBeInTheDocument();
    });
  });

  it("calls PUT on save", async () => {
    mockFetch();
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Save")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Save"));
    await waitFor(() => {
      const calls = vi.mocked(globalThis.fetch).mock.calls;
      const putCall = calls.find(
        ([, init]) => init && (init as RequestInit).method === "PUT",
      );
      expect(putCall).toBeDefined();
    });
  });

  it("shows loading initially", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders copy day button", async () => {
    mockFetch();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Copy from another day")).toBeInTheDocument();
    });
  });

  it("renders notes textarea", async () => {
    mockFetch();
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Any other notes about today..."),
      ).toBeInTheDocument();
    });
  });

  // --- #35: explicit save feedback + load-failure guard ---

  it("shows Saved ✓ after a successful save and clears it on edit", async () => {
    mockFetch();
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Save")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Save"));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved ✓");

    // Any edit invalidates the confirmation
    await user.click(screen.getByLabelText("Sick day"));
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("surfaces a failed save with the backend detail", async () => {
    mockFetch();
    vi.mocked(globalThis.fetch).mockImplementation(async (url, init) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/settings")) {
        return new Response(JSON.stringify(mockSettings));
      }
      if (urlStr.includes("/api/daily-log/") && init?.method === "PUT") {
        return new Response(
          JSON.stringify({ detail: "red-light panel 7 does not exist" }),
          { status: 409 },
        );
      }
      return new Response(JSON.stringify(mockLogOut));
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Save")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Save"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Save failed: red-light panel 7 does not exist",
    );
    // Form is still there — nothing lost
    expect(screen.getByText("Caffeine")).toBeInTheDocument();
  });

  it("falls back to a generic message when a 422 detail is not a string", async () => {
    mockFetch();
    vi.mocked(globalThis.fetch).mockImplementation(async (url, init) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/settings")) {
        return new Response(JSON.stringify(mockSettings));
      }
      if (urlStr.includes("/api/daily-log/") && init?.method === "PUT") {
        // FastAPI validation errors carry an array in detail
        return new Response(
          JSON.stringify({
            detail: [{ loc: ["body", "caffeine_entries"], msg: "bad" }],
          }),
          { status: 422 },
        );
      }
      return new Response(JSON.stringify(mockLogOut));
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Save")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Save"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Save failed (HTTP 422)",
    );
  });

  it("shows an error panel instead of an empty form when loading fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/settings")) {
        return new Response(JSON.stringify(mockSettings));
      }
      return new Response(JSON.stringify({ detail: "boom" }), { status: 500 });
    });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Loading this day failed: boom",
    );
    // The overwrite hazard: no editable form, no Save button
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
    expect(screen.queryByText("Caffeine")).not.toBeInTheDocument();
  });

  it("retry after a failed load fetches the day again", async () => {
    let failGet = true;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/settings")) {
        return new Response(JSON.stringify(mockSettings));
      }
      if (
        urlStr.includes("/api/daily-log/") &&
        (!init || !init.method || init.method === "GET")
      ) {
        if (failGet) {
          return new Response(JSON.stringify({ detail: "boom" }), {
            status: 500,
          });
        }
        return new Response(JSON.stringify(mockLogOut));
      }
      return new Response(JSON.stringify([]));
    });
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    failGet = false;
    await user.click(screen.getByText("Retry"));
    await waitFor(() => {
      expect(screen.getByText("Save")).toBeInTheDocument();
    });
    expect(screen.getByText("Caffeine")).toBeInTheDocument();
  });
});
