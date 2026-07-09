import { describe, it, expect, beforeEach, vi } from "vitest";
import { syncOura } from "./oura";

describe("syncOura", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls sync endpoint and returns result", async () => {
    const mockResult = {
      synced_count: 3,
      start_date: "2026-02-10",
      end_date: "2026-02-12",
      errors: [],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResult), { status: 200 }),
    );
    const result = await syncOura();
    expect(result).toEqual(mockResult);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/oura/sync",
      expect.objectContaining({
        method: "POST", // T-02: sync is a state-changing POST
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("passes date params as query string", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          synced_count: 0,
          start_date: "2026-02-01",
          end_date: "2026-02-02",
          errors: [],
        }),
      ),
    );
    await syncOura("2026-02-01", "2026-02-02");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/oura/sync?start_date=2026-02-01&end_date=2026-02-02",
      expect.anything(),
    );
  });

  it("throws on error response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Token not configured" }), {
        status: 403,
      }),
    );
    await expect(syncOura()).rejects.toThrow("Token not configured");
  });
});
