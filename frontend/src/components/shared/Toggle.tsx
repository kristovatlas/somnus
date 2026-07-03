import "./Toggle.css";

interface ToggleProps {
  label: string;
  checked: boolean | null;
  onChange: (checked: boolean) => void;
}

export function Toggle({ label, checked, onChange }: ToggleProps) {
  const isOn = checked ?? false;
  return (
    <label className="toggle">
      <span className="toggle-label">{label}</span>
      <span className="toggle-control">
        <span className={`toggle-state ${isOn ? "toggle-state--on" : ""}`}>
          {isOn ? "On" : "Off"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          className={`toggle-track ${isOn ? "toggle-track--on" : ""}`}
          onClick={() => onChange(!isOn)}
        >
          <span className="toggle-thumb" />
        </button>
      </span>
    </label>
  );
}
