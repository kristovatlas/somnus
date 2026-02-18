import { useCallback, useEffect, useState } from 'react'
import { useOnboarding } from '../../hooks/useOnboarding'
import { getSettings, updateSettings } from '../../api/settings'
import type { UserSettingsOut, UserSettingsUpdate } from '../../types'
import { WelcomeStep } from './WelcomeStep'
import { OuraStep } from './OuraStep'
import { SleepProfileStep } from './SleepProfileStep'
import { TrackingSetupStep } from './TrackingSetupStep'
import { DataStorageStep } from './DataStorageStep'
import { DoneStep } from './DoneStep'
import './OnboardingWizard.css'

export function OnboardingWizard() {
  const { step, progress, isFirst, isLast, next, back } = useOnboarding()
  const [settings, setSettings] = useState<UserSettingsOut | null>(null)

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {})
  }, [])

  const handleUpdate = useCallback(async (data: UserSettingsUpdate) => {
    const updated = await updateSettings(data)
    setSettings(updated)
    return updated
  }, [])

  if (!settings) {
    return <div style={{ color: 'var(--color-text-muted)' }}>Loading...</div>
  }

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <WelcomeStep
            age={settings.age}
            timezone={settings.timezone}
            onUpdate={handleUpdate}
            onNext={next}
          />
        )
      case 'oura':
        return (
          <OuraStep
            ouraTokenSet={settings.oura_token_set}
            onUpdate={handleUpdate}
            onNext={next}
            onBack={back}
          />
        )
      case 'sleep-profile':
        return (
          <SleepProfileStep
            typicalBedtime={settings.typical_bedtime}
            targetWakeTime={settings.target_wake_time}
            caffeineSensitivity={settings.caffeine_sensitivity}
            chronotype={settings.chronotype}
            onUpdate={handleUpdate}
            onNext={next}
            onBack={back}
          />
        )
      case 'tracking-setup':
        return <TrackingSetupStep onNext={next} onBack={back} />
      case 'data-storage':
        return <DataStorageStep onNext={next} onBack={back} />
      case 'done':
        return <DoneStep onUpdate={handleUpdate} />
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-progress">
        <div className="onboarding-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="onboarding-step">{renderStep()}</div>
      {!isFirst && !isLast && (
        <p className="onboarding-hint">
          Step {Math.round(progress / (100 / 6))} of 6
        </p>
      )}
    </div>
  )
}
