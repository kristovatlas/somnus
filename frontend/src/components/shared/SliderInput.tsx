interface SliderInputProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  labels?: string[];
}

export function SliderInput({
  label,
  value,
  onChange,
  min = 1,
  max = 5,
  step = 1,
  labels,
}: SliderInputProps) {
  return (
    <div className="slider-input">
      <label className="slider-input-label">
        {label}: {value ?? "—"}
        {labels && value != null && value >= min && value <= max
          ? ` (${labels[value - min]})`
          : ""}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? min}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--color-interactive)" }}
      />
    </div>
  );
}
