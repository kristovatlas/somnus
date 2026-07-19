import "./TimePicker.css";

interface TimePickerProps {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
}

export function TimePicker({ label, value, onChange }: TimePickerProps) {
  return (
    <div className="time-picker">
      <label className="time-picker-label">{label}</label>
      <div className="time-picker-row">
        <input
          type="time"
          className="time-picker-input"
          value={value?.slice(0, 5) ?? ""}
          onChange={(e) =>
            onChange(e.target.value ? `${e.target.value}:00` : null)
          }
        />
        <button
          type="button"
          className="time-picker-now"
          onClick={() => onChange(nowTimeStr())}
        >
          Now
        </button>
      </div>
    </div>
  );
}
