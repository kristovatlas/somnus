import './StepNavigation.css'

interface StepNavigationProps {
  isFirst: boolean
  isLast: boolean
  onBack: () => void
  onNext: () => void
  onSkip?: () => void
  nextLabel?: string
}

export function StepNavigation({
  isFirst,
  isLast,
  onBack,
  onNext,
  onSkip,
  nextLabel,
}: StepNavigationProps) {
  return (
    <div className="step-nav">
      {!isFirst && (
        <button type="button" className="step-nav-back" onClick={onBack}>
          Back
        </button>
      )}
      <div className="step-nav-spacer" />
      {onSkip && (
        <button type="button" className="step-nav-skip" onClick={onSkip}>
          Skip
        </button>
      )}
      {!isLast && (
        <button type="button" className="step-nav-next" onClick={onNext}>
          {nextLabel ?? 'Next'}
        </button>
      )}
    </div>
  )
}
