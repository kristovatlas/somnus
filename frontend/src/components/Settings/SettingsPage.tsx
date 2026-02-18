import { useSettings } from '../../hooks/useSettings'
import { OuraSection } from './OuraSection'
import { ProfileSection } from './ProfileSection'
import { PanelSection } from './PanelSection'
import { DisplaySection } from './DisplaySection'
import './SettingsPage.css'

export function SettingsPage() {
  const { settings, loading, error, update } = useSettings()

  if (loading) {
    return <div className="settings-loading">Loading settings...</div>
  }

  if (error || !settings) {
    return <div className="settings-error">Failed to load settings: {error}</div>
  }

  return (
    <div className="settings-page">
      <h1 className="settings-page-title">Settings</h1>
      <OuraSection settings={settings} onUpdate={update} />
      <ProfileSection settings={settings} onUpdate={update} />
      <PanelSection />
      <DisplaySection settings={settings} onUpdate={update} />
    </div>
  )
}
