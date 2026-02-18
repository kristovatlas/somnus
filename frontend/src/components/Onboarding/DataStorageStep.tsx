import { StepNavigation } from './StepNavigation'

interface DataStorageStepProps {
  onNext: () => void
  onBack: () => void
}

export function DataStorageStep({ onNext, onBack }: DataStorageStepProps) {
  return (
    <div>
      <h2>Your Data Stays Local</h2>
      <p style={{ color: 'var(--color-text-secondary)', margin: '0.5rem 0 1.5rem' }}>
        All your sleep and health data is stored locally on your machine. Nothing is sent to
        external servers.
      </p>

      <ul style={{ color: 'var(--color-text-secondary)', paddingLeft: '1.5rem', lineHeight: 2 }}>
        <li>Data stored in a local SQLite database</li>
        <li>Export your data anytime as JSON</li>
        <li>No cloud accounts required</li>
        <li>Oura data fetched directly to your machine</li>
      </ul>

      <StepNavigation isFirst={false} isLast={false} onBack={onBack} onNext={onNext} />
    </div>
  )
}
