interface NumberInputProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberInput({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step,
}: NumberInputProps) {
  return (
    <div className="number-input">
      <label className="number-input-label">{label}</label>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          min={min}
          max={max}
          step={step}
          style={{ flex: 1 }}
        />
        {unit && (
          <span
            style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
