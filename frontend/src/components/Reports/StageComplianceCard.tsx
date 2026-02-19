/** Shows deep/REM target hit rate for the period. */

import type { StageComplianceReport } from '../../types'

interface Props {
  compliance: StageComplianceReport | null
}

export function StageComplianceCard({ compliance }: Props) {
  if (!compliance) return null

  return (
    <div className="report-card" data-testid="stage-compliance">
      <h3 className="report-card-title">Stage Compliance</h3>
      <p className="report-compliance-line">
        Hit deep sleep target: {compliance.deep_target_nights}/{compliance.deep_total_nights} nights
      </p>
      <p className="report-compliance-line">
        Hit REM target: {compliance.rem_target_nights}/{compliance.rem_total_nights} nights
      </p>
    </div>
  )
}
