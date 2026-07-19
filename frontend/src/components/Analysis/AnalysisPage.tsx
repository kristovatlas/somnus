/** Analysis page — orchestrates sub-views based on data sufficiency. */

import {
  useAnalysisStatus,
  useCorrelations,
  useRegression,
  useTiming,
  useNaps,
} from "../../hooks/useAnalysis";
import { Explainer } from "./Explainer";
import { DataStatus } from "./DataStatus";
import { CorrelationList } from "./CorrelationList";
import { CorrelationHeatmap } from "./CorrelationHeatmap";
import { CoefficientChart } from "./CoefficientChart";
import { RegressionSummary } from "./RegressionSummary";
import { TimingView } from "./TimingView";
import { NapImpactView } from "./NapImpactView";
import "./AnalysisPage.css";

export function AnalysisPage() {
  const { data: status, loading, error } = useAnalysisStatus();

  const phaseA = status?.phase_a_unlocked ?? false;
  const phaseB = status?.phase_b_unlocked ?? false;
  const phaseC = status?.phase_c_unlocked ?? false;

  const { data: correlations } = useCorrelations(phaseA);
  const { data: regression } = useRegression(phaseB);
  const { data: timing } = useTiming(phaseC);
  const { data: naps } = useNaps(phaseC);

  if (loading) {
    return <div className="analysis-loading">Loading analysis...</div>;
  }

  if (error || !status) {
    return (
      <div className="analysis-error">
        {error ?? "Failed to load analysis."}
      </div>
    );
  }

  return (
    <div className="analysis-page" data-testid="analysis-page">
      <Explainer />
      <DataStatus status={status} />

      {/* Phase A: Correlations (14+ days) */}
      {phaseA && correlations && (
        <>
          <CorrelationList
            results={correlations.results}
            excludedSickDays={correlations.excluded_sick_days}
          />
          <CorrelationHeatmap results={correlations.results} />
        </>
      )}

      {!phaseA && (
        <div className="analysis-card analysis-gated">
          <h3 className="analysis-card-title">Correlations</h3>
          <p className="analysis-empty">
            Log at least 14 days of data to unlock correlation analysis.
          </p>
        </div>
      )}

      {/* Phase B: Regression (50+ days) */}
      {phaseB && regression && (
        <>
          <RegressionSummary results={regression.results} />
          {regression.results.map((r) => (
            <CoefficientChart key={r.outcome} result={r} />
          ))}
        </>
      )}

      {phaseA && !phaseB && (
        <div className="analysis-card analysis-gated">
          <h3 className="analysis-card-title">Regression</h3>
          <p className="analysis-empty">
            Log 50+ days to unlock regression models.
          </p>
        </div>
      )}

      {/* Phase C: Timing + Naps (30+ bedtimes) */}
      {phaseC && timing && <TimingView data={timing} />}
      {phaseC && naps && <NapImpactView data={naps} />}

      {phaseA && !phaseC && (
        <div className="analysis-card analysis-gated">
          <h3 className="analysis-card-title">Timing Analysis</h3>
          <p className="analysis-empty">
            Record 30+ days with bedtime data to unlock timing analysis.
          </p>
        </div>
      )}
    </div>
  );
}
