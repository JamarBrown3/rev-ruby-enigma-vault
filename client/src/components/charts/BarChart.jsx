// Horizontal bars for comparing categories. One series = one color (no rainbow).
// Bars are 20px thick with a rounded end and a square base, the value sits at
// the tip, and hovering or tabbing to a row shows its share of the total.
import { useState } from "react";

// showShare: false when the bars aren't parts of one whole (like averages per weekday).
export default function BarChart({ items, formatValue, color = "var(--series-1)", label, showShare = true }) {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...items.map((item) => item.value));
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;

  return (
    <div className="bar-chart" role="list" aria-label={label}>
      {items.map((item, index) => {
        const share = Math.round((item.value / total) * 100);
        return (
          <div
            key={item.label}
            className={`bar-row${active === index ? " is-active" : ""}`}
            role="listitem"
            tabIndex={0}
            aria-label={`${item.label}: ${formatValue(item.value)}${showShare ? `, ${share}% of the total` : ""}`}
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
          >
            <span className="bar-row__label">{item.label}</span>
            <span className="bar-row__track">
              {/* Bars share the space left after room for the value label, so they stay in proportion. */}
              <span className="bar-row__bar" style={{ width: `calc((100% - 84px) * ${item.value / max})`, background: color }} />
              <span className="bar-row__value">{formatValue(item.value)}</span>
              {showShare && active === index && (
                <span className="chart-tooltip chart-tooltip--bar" aria-hidden="true">
                  <strong>{share}%</strong> of the total
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
