import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { getSettings } from "../../api/settings";
import { ApiError } from "../../types/api";
import { OuraSyncIndicator } from "./OuraSyncIndicator";
import { applyThemeFromSettings, reapplyTheme } from "../../theme";
import type { UserSettingsOut } from "../../types";
import "./Layout.css";

// #36: labeled nav (owner design record, direction B) — icon + word for all
// six destinations, Feather-style stroke glyphs, curved line under the
// active icon as the selected-state indicator.
function navIcon(children: ReactNode) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

interface NavItem {
  path: string;
  label: string;
  name: string; // accessible name (aria-label + tooltip)
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: "/log",
    label: "Log",
    name: "Daily Log",
    icon: navIcon(
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>,
    ),
  },
  {
    path: "/dashboard",
    label: "Dashboard",
    name: "Dashboard",
    icon: navIcon(
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </>,
    ),
  },
  {
    path: "/analysis",
    label: "Analysis",
    name: "Analysis",
    icon: navIcon(<polyline points="3 17 9 11 13 15 21 7" />),
  },
  {
    path: "/recommendations",
    label: "Coach",
    name: "Coach",
    icon: navIcon(
      <>
        <path d="M9 18h6" />
        <path d="M10 21h4" />
        <path d="M12 3a6 6 0 0 1 4 10.5c-.7.6-1 1.4-1 2.5h-6c0-1.1-.3-1.9-1-2.5A6 6 0 0 1 12 3Z" />
      </>,
    ),
  },
  {
    path: "/reports",
    label: "Reports",
    name: "Reports",
    icon: navIcon(
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </>,
    ),
  },
  {
    path: "/settings",
    label: "Settings",
    name: "Settings",
    icon: navIcon(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>,
    ),
  },
];

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
        {/* WCAG 2.5.3: the accessible name must contain the visible text
            ("Somnus"), so the label is "Somnus — go to Dashboard" rather
            than just "Dashboard". role=button needs keyboard activation
            too: Enter and Space (Space preventDefaults to avoid scroll). */}
        <h1
          className="layout-title"
          onClick={() => navigate("/dashboard")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              if (e.key === " ") e.preventDefault();
              navigate("/dashboard");
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Somnus — go to Dashboard"
          title="Somnus — go to Dashboard"
        >
          Somnus
        </h1>
        {settings?.oura_token_set && settings.onboarding_completed && (
          <OuraSyncIndicator />
        )}
        <nav className="layout-nav">
          {NAV_ITEMS.map((item) => {
            const active =
              location.pathname === item.path ||
              location.pathname.startsWith(`${item.path}/`);
            return (
              <button
                key={item.path}
                className={
                  active
                    ? "layout-nav-btn layout-nav-btn-active"
                    : "layout-nav-btn"
                }
                onClick={() => navigate(item.path)}
                aria-label={item.name}
                title={item.name}
                aria-current={active ? "page" : undefined}
              >
                <span className="layout-nav-icon">{item.icon}</span>
                <span className="layout-nav-label" aria-hidden="true">
                  {item.label}
                </span>
              </button>
            );
          })}
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
