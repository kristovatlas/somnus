/** Data fetching hooks for analysis endpoints. */

import { useEffect, useState } from "react";
import {
  getAnalysisStatus,
  getCorrelations,
  getRegression,
  getTiming,
  getNaps,
} from "../api/analysis";
import type { AnalysisStatus } from "../types";

export function useAnalysisStatus() {
  const [data, setData] = useState<AnalysisStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAnalysisStatus()
      .then(setData)
      .catch((e: unknown) => {
        setError(
          e instanceof Error ? e.message : "Failed to load analysis status",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

interface FetchState<T> {
  data: T | null;
  error: string | null;
  resolved: boolean;
}

function useFetchWhenEnabled<T>(
  fetcher: () => Promise<T>,
  enabled: boolean,
  errorMsg: string,
) {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    error: null,
    resolved: false,
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    fetcher()
      .then((result) => {
        if (!cancelled) setState({ data: result, error: null, resolved: true });
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({
            data: null,
            error: e instanceof Error ? e.message : errorMsg,
            resolved: true,
          });
      });

    return () => {
      cancelled = true;
    };
    // fetcher and errorMsg are stable module-level values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    data: state.data,
    loading: enabled && !state.resolved,
    error: state.error,
  };
}

export function useCorrelations(enabled: boolean) {
  return useFetchWhenEnabled(
    getCorrelations,
    enabled,
    "Failed to load correlations",
  );
}

export function useRegression(enabled: boolean) {
  return useFetchWhenEnabled(
    getRegression,
    enabled,
    "Failed to load regression",
  );
}

export function useTiming(enabled: boolean) {
  return useFetchWhenEnabled(getTiming, enabled, "Failed to load timing");
}

export function useNaps(enabled: boolean) {
  return useFetchWhenEnabled(getNaps, enabled, "Failed to load nap analysis");
}
