import { useNavigate } from 'react-router-dom'
import type { UserSettingsUpdate } from '../../types'

interface DoneStepProps {
  onUpdate: (data: UserSettingsUpdate) => void
}

export function DoneStep({ onUpdate }: DoneStepProps) {
  const navigate = useNavigate()

  const handleFinish = async () => {
    await onUpdate({ onboarding_completed: true })
    navigate('/log', { replace: true })
  }

  return (
    <div>
      <h2>You&apos;re All Set!</h2>
      <p style={{ color: 'var(--color-text-secondary)', margin: '0.5rem 0 1.5rem' }}>
        Start logging your day to discover what helps you sleep better.
      </p>

      <ul style={{ color: 'var(--color-text-secondary)', paddingLeft: '1.5rem', lineHeight: 2 }}>
        <li>Log caffeine, meals, and habits throughout the day</li>
        <li>Review your sleep data each morning</li>
        <li>After 7+ days, check the dashboard for insights</li>
      </ul>

      <button
        type="button"
        onClick={handleFinish}
        style={{ marginTop: '1.5rem', width: '100%', padding: '12px' }}
      >
        Start Logging
      </button>
    </div>
  )
}
