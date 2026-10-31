// "Last 7 days / Last 30 days" picker. Real radio buttons underneath, so the
// arrow keys and screen readers work without extra code.
import { useId } from "react";

export default function RangePicker({ value, options, onChange, label = "Date range" }) {
  const name = useId();
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      <div className="segmented">
        {options.map((days) => (
          <label key={days} className="segmented__option">
            <input type="radio" name={name} value={days} checked={value === days} onChange={() => onChange(days)} />
            <span>Last {days} days</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
