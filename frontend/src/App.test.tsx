import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the app title", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", version: "0.1.0" })),
    );
    render(<App />);
    expect(screen.getByText("Somnus")).toBeInTheDocument();
  });

  it("renders the tagline", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", version: "0.1.0" })),
    );
    render(<App />);
    expect(
      screen.getByText("Sleep optimization, powered by your data"),
    ).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.getByText("Connecting to backend...")).toBeInTheDocument();
  });

  it("shows backend status on successful health check", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", version: "0.1.0" })),
    );
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("ok")).toBeInTheDocument();
      expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument();
    });
  });

  it("shows error when backend is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Backend not reachable")).toBeInTheDocument();
    });
  });

  it("calls /api/health on mount", () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "ok", version: "0.1.0" })),
      );
    render(<App />);
    expect(fetchSpy).toHaveBeenCalledWith("/api/health");
  });
});
