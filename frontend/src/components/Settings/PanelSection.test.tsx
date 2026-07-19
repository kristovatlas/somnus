import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PanelSection } from "./PanelSection";

const panel = {
  id: 1,
  name: "My Panel",
  wavelength_nm: 660,
  irradiance_mw_cm2: 100,
  default_distance_inches: 6,
  notes: null,
};

describe("PanelSection (#60 edit + distance)", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows the rated distance and an Edit button for each panel", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify([panel])),
    );
    render(<PanelSection />);
    expect(await screen.findByText("My Panel")).toBeInTheDocument();
    expect(screen.getByText(/@ 6/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("edit sends a PUT with the changed distance", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      calls.push({ url: String(url), init: init ?? undefined });
      if (init?.method === "PUT") {
        return new Response(
          JSON.stringify({ ...panel, default_distance_inches: 12 }),
        );
      }
      return new Response(JSON.stringify([panel]));
    });
    const user = userEvent.setup();
    render(<PanelSection />);
    await user.click(await screen.findByRole("button", { name: "Edit" }));

    const distance = screen.getByPlaceholderText("Distance (inches)");
    await user.clear(distance);
    await user.type(distance, "12");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const put = calls.find((c) => c.init?.method === "PUT");
      expect(put).toBeDefined();
      expect(put!.url).toContain("/api/red-light-panels/1");
      expect(
        JSON.parse(put!.init!.body as string).default_distance_inches,
      ).toBe(12);
    });
  });

  it("add form includes a distance field", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify([])),
    );
    const user = userEvent.setup();
    render(<PanelSection />);
    await user.click(
      await screen.findByRole("button", { name: "+ Add Panel" }),
    );
    expect(
      screen.getByPlaceholderText("Distance (inches)"),
    ).toBeInTheDocument();
  });
});
