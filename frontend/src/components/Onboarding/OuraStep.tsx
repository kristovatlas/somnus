import { useState } from 'react'
import { StepNavigation } from './StepNavigation'
import type { UserSettingsUpdate } from '../../types'

interface OuraStepProps {
  ouraTokenSet: boolean
  onUpdate: (data: UserSettingsUpdate) => void
  onNext: () => void
  onBack: () => void
}

export function OuraStep({ ouraTokenSet, onUpdate, onNext, onBack }: OuraStepProps) {
  const [token, setToken] = useState('')

  const handleSave = () => {
    if (token.trim()) {
      onUpdate({ oura_token: token.trim() })
    }
    onNext()
  }

  return (
    <div>
      <h2>Oura Ring Integration</h2>
      <p style={{ color: 'var(--color-text-secondary)', margin: '0.5rem 0 1.5rem' }}>
        Connect your Oura Ring to automatically import sleep data. You can always add this later.
      </p>

      {ouraTokenSet ? (
        <p style={{ color: 'var(--color-success)' }}>Oura token is already configured.</p>
      ) : (
        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Personal Access Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your Oura token"
            style={{ width: '100%' }}
          />
        </div>
      )}

      <StepNavigation
        isFirst={false}
        isLast={false}
        onBack={onBack}
        onNext={handleSave}
        onSkip={onNext}
        nextLabel={token.trim() ? 'Save & Continue' : 'Next'}
      />
    </div>
  )
}
