/** Data fetching hooks for recommendations endpoints. */

import { useCallback, useEffect, useState } from "react";
import {
  getRecommendations,
  createExperiment as apiCreateExperiment,
  updateExperiment as apiUpdateExperiment,
} from "../api/recommendations";
import type {
  RecommendationsResponse,
  ExperimentCreate,
  ExperimentUpdate,
  ExperimentOut,
} from "../types";

export function useRecommendations() {
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecommendations()
      .then(setData)
      .catch((e: unknown) => {
        setError(
          e instanceof Error ? e.message : "Failed to load recommendations",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    getRecommendations()
      .then(setData)
      .catch((e: unknown) => {
        setError(
          e instanceof Error ? e.message : "Failed to load recommendations",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const createExperiment = useCallback(
    async (body: ExperimentCreate): Promise<ExperimentOut> => {
      const result = await apiCreateExperiment(body);
      refetch();
      return result;
    },
    [refetch],
  );

  const updateExperiment = useCallback(
    async (id: number, body: ExperimentUpdate): Promise<ExperimentOut> => {
      const result = await apiUpdateExperiment(id, body);
      refetch();
      return result;
    },
    [refetch],
  );

  return { data, loading, error, refetch, createExperiment, updateExperiment };
}
