import { useState } from "react";
import { copyDay } from "../../api/dailyLog";
import type { DailyLogOut } from "../../types";
import { addDays } from "../../utils/date";
import "./CopyDayButton.css";

interface CopyDayButtonProps {
  targetDate: string;
  onCopied: (log: DailyLogOut) => void;
}

export function CopyDayButton({ targetDate, onCopied }: CopyDayButtonProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [sourceDate, setSourceDate] = useState(addDays(targetDate, -1));
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async () => {
    setCopying(true);
    setError(null);
    try {
      const log = await copyDay(targetDate, sourceDate);
      onCopied(log);
      setShowPicker(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setCopying(false);
    }
  };

  if (!showPicker) {
    return (
      <button
        type="button"
        className="copy-day-trigger"
        onClick={() => setShowPicker(true)}
      >
        Copy from another day
      </button>
    );
  }

  return (
    <div className="copy-day-picker">
      <label className="copy-day-label">Copy entries from:</label>
      <input
        type="date"
        value={sourceDate}
        onChange={(e) => setSourceDate(e.target.value)}
        max={targetDate}
      />
      <div className="copy-day-actions">
        <button type="button" onClick={handleCopy} disabled={copying}>
          {copying ? "Copying..." : "Copy"}
        </button>
        <button
          type="button"
          className="copy-day-cancel"
          onClick={() => setShowPicker(false)}
        >
          Cancel
        </button>
      </div>
      {error && <p className="copy-day-error">{error}</p>}
    </div>
  );
}
