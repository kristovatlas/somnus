import { useState } from 'react'
import { syncOura } from '../../api/oura'
import type { OuraSyncResponse, UserSettingsOut, UserSettingsUpdate } from '../../types'
import './OuraSection.css'

interface OuraSectionProps {
  settings: UserSettingsOut
  onUpdate: (data: UserSettingsUpdate) => Promise<UserSettingsOut>
}

export function OuraSection({ settings, onUpdate }: OuraSectionProps) {
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<OuraSyncResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSaveToken() {
    if (!token.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onUpdate({ oura_token: token.trim() })
      setToken('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save token')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveToken() {
    setSaving(true)
    setError(null)
    try {
      await onUpdate({ oura_token: null })
      setSyncResult(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove token')
    } finally {
      setSaving(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setError(null)
    setSyncResult(null)
    try {
      const result = await syncOura()
      setSyncResult(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section-title">Oura Ring</h2>

      <div className="oura-status">
        <span className={`oura-status-dot ${settings.oura_token_set ? 'oura-status-dot--connected' : ''}`} />
        <span>{settings.oura_token_set ? 'Connected' : 'Not connected'}</span>
      </div>

      {!settings.oura_token_set ? (
        <div className="oura-token-form">
          <label className="oura-token-label" htmlFor="oura-token">
            Personal Access Token
          </label>
          <div className="oura-token-row">
            <input
              id="oura-token"
              type="password"
              className="oura-token-input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your Oura PAT here"
            />
            <button onClick={handleSaveToken} disabled={saving || !token.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          <p className="oura-token-hint">
            Get your token at{' '}
            <a href="https://cloud.ouraring.com/personal-access-tokens" target="_blank" rel="noopener noreferrer">
              cloud.ouraring.com
            </a>
          </p>
        </div>
      ) : (
        <div className="oura-connected">
          <button className="oura-remove-btn" onClick={handleRemoveToken} disabled={saving}>
            {saving ? 'Removing...' : 'Remove Token'}
          </button>

          <div className="oura-sync-row">
            <button onClick={handleSync} disabled={syncing}>
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            {settings.last_oura_sync && (
              <span className="oura-last-sync">
                Last sync: {new Date(settings.last_oura_sync).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}

      {syncResult && (
        <div className="oura-sync-result">
          <p>Synced {syncResult.synced_count} day(s) ({syncResult.start_date} to {syncResult.end_date})</p>
          {syncResult.errors.map((err, i) => (
            <p key={i} className="oura-sync-error">{err}</p>
          ))}
        </div>
      )}

      {error && <p className="oura-error">{error}</p>}
    </section>
  )
}
