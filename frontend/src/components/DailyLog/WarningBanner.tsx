import "./WarningBanner.css";

interface WarningBannerProps {
  warnings: string[];
  onDismiss: () => void;
}

export function WarningBanner({ warnings, onDismiss }: WarningBannerProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="warning-banner" role="alert">
      <div className="warning-banner-content">
        {warnings.map((w, i) => (
          <p key={i}>{w}</p>
        ))}
      </div>
      <button
        type="button"
        className="warning-banner-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss warnings"
      >
        &times;
      </button>
    </div>
  );
}
