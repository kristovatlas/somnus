// #100: the dashboard must refetch when a launch sync lands after its
// mount fetch (the race that showed yesterday's night on first paint).
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboard } from "./useDashboard";
import { announceSyncComplete } from "../syncEvents";
import { getDashboard } from "../api/dashboard";
import type { DashboardData } from "../types";

vi.mock("../api/dashboard", () => ({ getDashboard: vi.fn() }));

const mockGet = vi.mocked(getDashboard);
const day = (d: string) => ({ sleep: { date: d } }) as unknown as DashboardData;

describe("useDashboard sync refetch (#100)", () => {
  beforeEach(() => mockGet.mockReset());

  it("refetches when a sync completes with new data", async () => {
    mockGet
      .mockResolvedValueOnce(day("2026-07-18"))
      .mockResolvedValueOnce(day("2026-07-19"));
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.data).toEqual(day("2026-07-18")));

    act(() => announceSyncComplete(1));
    await waitFor(() => expect(result.current.data).toEqual(day("2026-07-19")));
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false); // silent — no loading flash
  });

  it("does not refetch when the sync brought nothing", async () => {
    mockGet.mockResolvedValue(day("2026-07-18"));
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.data).toEqual(day("2026-07-18")));

    act(() => announceSyncComplete(0));
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("clears a prior error when the sync refetch recovers", async () => {
    mockGet
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(day("2026-07-19"));
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.error).toBe("down"));

    act(() => announceSyncComplete(1));
    await waitFor(() => expect(result.current.data).toEqual(day("2026-07-19")));
    expect(result.current.error).toBeNull(); // recovery, not stuck error page
  });

  it("ignores a stale mount response that resolves after the refetch", async () => {
    let resolveMount!: (d: DashboardData) => void;
    mockGet
      .mockImplementationOnce(
        () => new Promise<DashboardData>((res) => (resolveMount = res)),
      )
      .mockResolvedValueOnce(day("2026-07-19"));
    const { result } = renderHook(() => useDashboard());

    act(() => announceSyncComplete(1)); // refetch resolves first
    await waitFor(() => expect(result.current.data).toEqual(day("2026-07-19")));

    act(() => resolveMount(day("2026-07-18"))); // slow pre-sync response lands
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(result.current.data).toEqual(day("2026-07-19")); // not overwritten
  });

  it("keeps showing stale data if the refetch fails", async () => {
    mockGet
      .mockResolvedValueOnce(day("2026-07-18"))
      .mockRejectedValueOnce(new Error("down"));
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.data).toEqual(day("2026-07-18")));

    act(() => announceSyncComplete(2));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(result.current.data).toEqual(day("2026-07-18"));
    expect(result.current.error).toBeNull();
  });
});
