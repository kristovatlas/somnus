import { useState } from 'react'
import { Toggle } from '../shared/Toggle'
import { StepNavigation } from './StepNavigation'

const TRACKING_ITEMS = [
  { key: 'caffeine', label: 'Caffeine intake' },
  { key: 'meals', label: 'Meal timing' },
  { key: 'supplements', label: 'Supplements' },
  { key: 'exercise', label: 'Exercise' },
  { key: 'sunlight', label: 'Sunlight exposure' },
  { key: 'naps', label: 'Naps' },
  { key: 'stress', label: 'Stress level' },
  { key: 'alcohol', label: 'Alcohol' },
  { key: 'screens', label: 'Screen time before bed' },
  { key: 'rituals', label: 'Pre-bed rituals' },
  { key: 'redLight', label: 'Red light therapy' },
  { key: 'nsdr', label: 'NSDR / Yoga Nidra' },
] as const

interface TrackingSetupStepProps {
  onNext: () => void
  onBack: () => void
}

export function TrackingSetupStep({ onNext, onBack }: TrackingSetupStepProps) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('somnus-tracked-sections')
    if (stored) return new Set(JSON.parse(stored) as string[])
    // Default: most items on
    return new Set(TRACKING_ITEMS.map((i) => i.key))
  })

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleNext = () => {
    localStorage.setItem('somnus-tracked-sections', JSON.stringify([...selected]))
    onNext()
  }

  return (
    <div>
      <h2>What do you want to track?</h2>
      <p style={{ color: 'var(--color-text-secondary)', margin: '0.5rem 0 1.5rem' }}>
        Choose which items appear in your daily log. You can change this anytime.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {TRACKING_ITEMS.map((item) => (
          <Toggle
            key={item.key}
            label={item.label}
            checked={selected.has(item.key)}
            onChange={() => toggle(item.key)}
          />
        ))}
      </div>

      <StepNavigation isFirst={false} isLast={false} onBack={onBack} onNext={handleNext} />
    </div>
  )
}
