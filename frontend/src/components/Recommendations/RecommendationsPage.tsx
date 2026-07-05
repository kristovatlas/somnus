/** Recommendations page — orchestrates cards, experiment tracker, and explainer. */

import { useState } from "react";
import { useRecommendations } from "../../hooks/useRecommendations";
import { RecommendationCard } from "./RecommendationCard";
import { ExperimentTracker } from "./ExperimentTracker";
import type { Recommendation } from "../../types";
import { todayStr } from "../../utils/date";
import "./RecommendationsPage.css";

export function RecommendationsPage() {
  const { data, loading, error, createExperiment, updateExperiment } =
    useRecommendations();
  const [showExplainer, setShowExplainer] = useState(false);

  if (loading) {
    return (
      <div className="recommendations-loading">Loading recommendations...</div>
    );
  }

  if (error || !data) {
    return (
      <div className="recommendations-error">
        {error ?? "Failed to load recommendations."}
      </div>
    );
  }

  if (!data.has_sufficient_data) {
    return (
      <div className="recommendations-page" data-testid="recommendations-page">
        <div className="recommendations-gated">
          <div className="recommendations-gated-count">
            {data.total_days} days
          </div>
          <p className="recommendations-gated-msg">
            Log 50+ days to unlock personalized recommendations.
          </p>
        </div>
      </div>
    );
  }

  const hasActiveExperiment = data.active_experiment !== null;

  const handleStartExperiment = async (rec: Recommendation) => {
    const today = todayStr();
    await createExperiment({
      factor: rec.factor,
      hypothesis: rec.suggested_experiment ?? rec.title,
      start_date: today,
    });
  };

  const handleComplete = async () => {
    if (data.active_experiment) {
      await updateExperiment(data.active_experiment.id, {
        status: "completed",
      });
    }
  };

  const handleAbandon = async () => {
    if (data.active_experiment) {
      await updateExperiment(data.active_experiment.id, {
        status: "abandoned",
      });
    }
  };

  return (
    <div className="recommendations-page" data-testid="recommendations-page">
      {data.active_experiment && (
        <ExperimentTracker
          experiment={data.active_experiment}
          onComplete={handleComplete}
          onAbandon={handleAbandon}
        />
      )}

      {data.recommendations.map((rec) => (
        <RecommendationCard
          key={rec.id}
          rec={rec}
          canStartExperiment={
            !hasActiveExperiment && rec.suggested_experiment !== null
          }
          onStartExperiment={handleStartExperiment}
        />
      ))}

      <div className="recommendations-explainer">
        <button
          className="recommendations-explainer-toggle"
          onClick={() => setShowExplainer((s) => !s)}
        >
          {showExplainer ? "Hide" : "How recommendations work"}
        </button>
        {showExplainer && (
          <div className="recommendations-explainer-content">
            <p>
              These recommendations are based on patterns found in your personal
              data combined with findings from sleep research. They reflect
              statistical associations, not proven cause-and-effect
              relationships.
            </p>
            <p>
              Use the experiment feature to deliberately test one change at a
              time for about two weeks. This helps you see whether a specific
              change makes a measurable difference for you personally.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
