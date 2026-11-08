// Horizontal bars for comparing categories. One series = one color (no rainbow).
// Bars are 20px thick with a rounded end and a square base, the value sits at
// the tip, and hovering, tapping or tabbing to a row shows a tooltip:
//   showShare (default): "38% of the total"  (bars are parts of one whole, like categories)
//   showShare={false}:   "12% above the average" (bars are separate, like weekdays)
import { useState } from "react";

// showShare: false when the bars aren't parts of one whole (like averages per weekday).
export default function BarChart({ items, formatValue, color = "var(--series-1)", label, showShare = true }) {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...items.map((item) => item.value));
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  const average = total / (items.length || 1);
  const min = Math.min(...items.map((item) => item.value));

  return (
    <div className="bar-chart" role="list" aria-label={label}>
      {items.map((item, index) => {
        const share = Math.round((item.value / total) * 100);
        // Compared with the average bar: +12 means 12% above it.
        const vsAverage = Math.round(((item.value - average) / average) * 100);
        const rank = item.value === max ? "Highest. " : item.value === min ? "Lowest. " : "";
        const comparison =
          vsAverage === 0 ? "About the average" : `${Math.abs(vsAverage)}% ${vsAverage > 0 ? "above" : "below"} the average`;
        const detail = showShare ? `${share}% of the total` : `${rank}${comparison}`;
        return (
          <div
            key={item.label}
            className={`bar-row${active === index ? " is-active" : ""}`}
            role="listitem"
            tabIndex={0}
            aria-label={`${item.label}: ${formatValue(item.value)}, ${detail}`}
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setActive(null); // hide the tooltip, keep focus
            }}
          >
            <span className="bar-row__label">{item.label}</span>
            <span className="bar-row__track">
              {/* Bars share the space left after room for the value label, so they stay in proportion. */}
              <span className="bar-row__bar" style={{ width: `calc((100% - 84px) * ${item.value / max})`, background: color }} />
              <span className="bar-row__value">{formatValue(item.value)}</span>
              {active === index && (
                <span className="chart-tooltip chart-tooltip--bar" aria-hidden="true">
                  {showShare ? (
                    <>
                      <strong>{share}%</strong> of the total
                    </>
                  ) : (
                    <>
                      {rank}
                      <strong>{comparison}</strong>
                    </>
                  )}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
