interface SelectInputProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly T[];
  labels: Record<T, string>;
}

export function SelectInput<T extends string>({
  label,
  value,
  onChange,
  options,
  labels,
}: SelectInputProps<T>) {
  return (
    <div className="select-input">
      <label className="select-input-label">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labels[opt]}
          </option>
        ))}
      </select>
    </div>
  );
}
