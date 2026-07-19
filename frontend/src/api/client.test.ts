import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchJson, fetchVoid } from "./client";
import { ApiError } from "../types/api";

describe("fetchJson", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), { status: 200 }),
    );
    const result = await fetchJson<{ id: number }>("/api/test");
    expect(result).toEqual({ id: 1 });
  });

  it("sends Content-Type header", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    await fetchJson("/api/test");
    expect(spy).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("throws ApiError with detail on error response", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ detail: "Not found" }), { status: 404 }),
    );
    try {
      await fetchJson("/api/test");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(404);
      expect((e as ApiError).detail).toBe("Not found");
    }
  });

  it("uses statusText when body has no detail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not json", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    );
    try {
      await fetchJson("/api/test");
    } catch (e) {
      expect((e as ApiError).detail).toBe("Internal Server Error");
    }
  });
});

describe("fetchVoid", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await expect(
      fetchVoid("/api/test", { method: "DELETE" }),
    ).resolves.toBeUndefined();
  });

  it("throws ApiError on error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Gone" }), { status: 410 }),
    );
    await expect(fetchVoid("/api/test")).rejects.toThrow(ApiError);
  });
});
