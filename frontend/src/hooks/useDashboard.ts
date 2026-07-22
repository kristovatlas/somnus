import { useCallback, useEffect, useRef, useState } from "react";
import { getDashboard } from "../api/dashboard";
import { onSyncComplete } from "../syncEvents";
import type { DashboardData } from "../types";

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Monotonic request sequence: only the newest request may write state,
  // so a slow mount fetch can't overwrite a fresher sync-triggered refetch
  // (PR #118 review, Codex P2).
  const seqRef = useRef(0);

  // silent=true (sync-triggered refetch): no loading flash, and a failure
  // keeps the stale data — what's on screen is still the best known. A
  // SUCCESS clears any prior error: fresh data means we've recovered
  // (PR #118 review, Claude LOW + Codex P2). No synchronous setState in
  // here: the mount effect calls this directly (react-hooks rule), so the
  // loading flag is set by the initial state / by refresh(), never by load.
  const load = useCallback((silent: boolean) => {
    const seq = ++seqRef.current;
    getDashboard()
      .then((d) => {
        if (seq !== seqRef.current) return; // a newer request owns the state
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (seq !== seqRef.current || silent) return;
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      })
      .finally(() => {
        if (seq === seqRef.current && !silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  // #100: the launch sync always finishes after the mount fetch above, so
  // refetch when it lands (no-op when the sync brought nothing).
  useEffect(
    () =>
      onSyncComplete((syncedCount) => {
        if (syncedCount === 0) return;
        load(true);
      }),
    [load],
  );

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    load(false);
  }, [load]);

  return { data, loading, error, refresh };
}
