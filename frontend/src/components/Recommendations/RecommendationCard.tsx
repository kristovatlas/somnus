/** Single recommendation card with category badge and evidence level. */

import type { Recommendation } from '../../types'

const CATEGORY_LABELS: Record<string, string> = {
  data_driven: 'Your Data',
  science_threshold: 'Science',
  untried: 'Try It',
  timing: 'Timing',
}

const EVIDENCE_LABELS: Record<string, string> = {
  very_high: 'Strong',
  high: 'Good',
  moderate: 'Moderate',
  low: 'Preliminary',
}

interface Props {
  rec: Recommendation
  canStartExperiment: boolean
  onStartExperiment: (rec: Recommendation) => void
}

export function RecommendationCard({ rec, canStartExperiment, onStartExperiment }: Props) {
  return (
    <div className="rec-card" data-testid="recommendation-card">
      <div className="rec-card-header">
        <span className="rec-category-badge" data-category={rec.category}>
          {CATEGORY_LABELS[rec.category] ?? rec.category}
        </span>
        {rec.evidence_level && (
          <span className="rec-evidence-pill" data-level={rec.evidence_level}>
            {EVIDENCE_LABELS[rec.evidence_level] ?? rec.evidence_level}
          </span>
        )}
      </div>
      <h3 className="rec-card-title">{rec.title}</h3>
      <p className="rec-card-body">{rec.body}</p>
      {rec.suggested_experiment && canStartExperiment && (
        <button
          className="rec-experiment-btn"
          onClick={() => onStartExperiment(rec)}
          aria-label={`Start experiment: ${rec.suggested_experiment}`}
        >
          Start experiment
        </button>
      )}
    </div>
  )
}
