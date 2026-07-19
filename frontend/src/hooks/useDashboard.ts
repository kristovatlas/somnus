import { useCallback, useEffect, useState } from "react";
import { getDashboard } from "../api/dashboard";
import { onSyncComplete } from "../syncEvents";
import type { DashboardData } from "../types";

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      })
      .finally(() => setLoading(false));
  }, []);

  // #100: the launch sync always finishes after the mount fetch above, so
  // refetch when it lands. Silent (no loading flash) and keep-stale-on-fail:
  // the data on screen is still the best known.
  useEffect(
    () =>
      onSyncComplete((syncedCount) => {
        if (syncedCount === 0) return;
        getDashboard()
          .then(setData)
          .catch(() => {});
      }),
    [],
  );

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    getDashboard()
      .then(setData)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      })
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error, refresh };
}
