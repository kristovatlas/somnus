import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { getSettings } from '../../api/settings'
import type { UserSettingsOut } from '../../types'
import './Layout.css'

export function Layout() {
  const [settings, setSettings] = useState<UserSettingsOut | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  const fetchSettings = useCallback(() => {
    getSettings()
      .then(setSettings)
      .catch(() => setSettings(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  useEffect(() => {
    if (loading || !settings) return

    const onOnboarding = location.pathname.startsWith('/onboarding')

    if (!settings.onboarding_completed && !onOnboarding) {
      navigate('/onboarding', { replace: true })
    } else if (settings.onboarding_completed && onOnboarding) {
      navigate('/log', { replace: true })
    }
  }, [settings, loading, location.pathname, navigate])

  if (loading) {
    return (
      <div className="layout">
        <div className="layout-loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="layout">
      <header className="layout-header">
        <h1 className="layout-title" onClick={() => navigate('/log')} role="button" tabIndex={0}>
          Somnus
        </h1>
        <nav className="layout-nav">
          <button
            className="layout-nav-btn"
            onClick={() => navigate('/dashboard')}
            aria-label="Dashboard"
            title="Dashboard"
          >
            &#9634;
          </button>
          <button
            className="layout-nav-btn"
            onClick={() => navigate('/analysis')}
            aria-label="Analysis"
            title="Analysis"
          >
            &#9651;
          </button>
          <button
            className="layout-nav-btn"
            onClick={() => navigate('/recommendations')}
            aria-label="Recommendations"
            title="Recommendations"
          >
            &#9733;
          </button>
          <button
            className="layout-nav-btn"
            onClick={() => navigate('/reports')}
            aria-label="Reports"
            title="Reports"
          >
            &#9776;
          </button>
          <button
            className="layout-nav-btn"
            onClick={() => navigate('/settings')}
            aria-label="Settings"
            title="Settings"
          >
            &#9881;
          </button>
        </nav>
      </header>
      <main className="layout-main">
        <Outlet context={{ refreshSettings: fetchSettings }} />
      </main>
    </div>
  )
}
