/** Logging streak display — large number with color based on length. */

interface LoggingStreakProps {
  streak: number;
}

export function LoggingStreak({ streak }: LoggingStreakProps) {
  const color =
    streak >= 7
      ? "var(--color-success)"
      : streak >= 3
        ? "var(--color-warning)"
        : "var(--color-text-muted)";

  return (
    <div
      className="dashboard-card dashboard-card-compact"
      data-testid="logging-streak"
    >
      <h3 className="dashboard-card-title">Logging Streak</h3>
      <div className="streak-display">
        <span className="streak-number" style={{ color }}>
          {streak}
        </span>
        <span className="streak-unit">day{streak !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}
