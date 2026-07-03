/** API functions for recommendations and experiment endpoints. */

import { fetchJson } from "./client";
import type {
  RecommendationsResponse,
  ExperimentOut,
  ExperimentCreate,
  ExperimentUpdate,
} from "../types";

export function getRecommendations(): Promise<RecommendationsResponse> {
  return fetchJson<RecommendationsResponse>("/api/recommendations");
}

export function getExperiments(): Promise<ExperimentOut[]> {
  return fetchJson<ExperimentOut[]>("/api/experiments");
}

export function createExperiment(
  data: ExperimentCreate,
): Promise<ExperimentOut> {
  return fetchJson<ExperimentOut>("/api/experiments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getExperiment(id: number): Promise<ExperimentOut> {
  return fetchJson<ExperimentOut>(`/api/experiments/${id}`);
}

export function updateExperiment(
  id: number,
  data: ExperimentUpdate,
): Promise<ExperimentOut> {
  return fetchJson<ExperimentOut>(`/api/experiments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
