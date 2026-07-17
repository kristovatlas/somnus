import { useCallback, useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { getSettings } from "../../api/settings";
import { ApiError } from "../../types/api";
import { applyThemeFromSettings, reapplyTheme } from "../../theme";
import type { UserSettingsOut } from "../../types";
import "./Layout.css";

export function Layout() {
  const [settings, setSettings] = useState<UserSettingsOut | null>(null);
  const [loading, setLoading] = useState(true);
  // #51: the shell-level backend-trouble signal — pages still show their
  // own error strings; this names the common cause once, with a retry.
  const [shellError, setShellError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchSettings = useCallback(() => {
    getSettings()
      .then((s) => {
        setSettings(s);
        setShellError(null);
      })
      .catch((e: unknown) => {
        setSettings(null);
        // An HTTP error means the server is up but unhealthy — say so
        // instead of overclaiming "not reachable" (review L2).
        setShellError(
          e instanceof ApiError
            ? `Backend error loading settings (HTTP ${e.status}).`
            : "Backend not reachable — is the server running? Start it with 'make dev' (port 8000).",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // #46: the display-mode setting decides the body theme class. The
  // interval re-ticks every minute so Auto mode crosses its start/wake
  // boundaries while the app sits open — via reapplyTheme(), which reads
  // the FRESHEST applied settings (useSettings.update() re-applies on
  // every PATCH); ticking from this effect's own `settings` would revert
  // a just-changed theme to Layout's stale mount-time snapshot.
  useEffect(() => {
    if (!settings) return;
    applyThemeFromSettings(settings);
    const timer = setInterval(() => reapplyTheme(), 60_000);
    return () => clearInterval(timer);
  }, [settings]);

  useEffect(() => {
    if (loading || !settings) return;

    const onOnboarding = location.pathname.startsWith("/onboarding");

    if (!settings.onboarding_completed && !onOnboarding) {
      navigate("/onboarding", { replace: true });
    } else if (settings.onboarding_completed && onOnboarding) {
      navigate("/log", { replace: true });
    }
  }, [settings, loading, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="layout">
        <div className="layout-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="layout">
      <header className="layout-header">
        <h1
          className="layout-title"
          onClick={() => navigate("/log")}
          role="button"
          tabIndex={0}
        >
          Somnus
        </h1>
        <nav className="layout-nav">
          <button
            className="layout-nav-btn"
            onClick={() => navigate("/dashboard")}
            aria-label="Dashboard"
            title="Dashboard"
          >
            &#9634;
          </button>
          <button
            className="layout-nav-btn"
            onClick={() => navigate("/analysis")}
            aria-label="Analysis"
            title="Analysis"
          >
            &#9651;
          </button>
          <button
            className="layout-nav-btn"
            onClick={() => navigate("/recommendations")}
            aria-label="Recommendations"
            title="Recommendations"
          >
            &#9733;
          </button>
          <button
            className="layout-nav-btn"
            onClick={() => navigate("/reports")}
            aria-label="Reports"
            title="Reports"
          >
            &#9776;
          </button>
          <button
            className="layout-nav-btn"
            onClick={() => navigate("/settings")}
            aria-label="Settings"
            title="Settings"
          >
            &#9881;
          </button>
        </nav>
      </header>
      <main className="layout-main">
        {shellError && (
          <div className="layout-unreachable" role="alert">
            <span>{shellError}</span>
            <button type="button" onClick={fetchSettings}>
              Retry
            </button>
          </div>
        )}
        <Outlet context={{ refreshSettings: fetchSettings }} />
      </main>
    </div>
  );
}
