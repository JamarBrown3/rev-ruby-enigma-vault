// "Slices of one whole" chart: REV's version of a pie chart.
// One thick bar split into blocks, one block per part, each block as wide as its
// share. People compare lengths side by side far better than pie angles, so this
// does a pie's job more clearly. Use it for 2 to 6 parts that add up to 100%.
//
//   items:       [{ label: "Pastries", value: 1200 }, ...]  (any order; it sorts biggest first)
//   formatValue: turns a number into text, like money
//   label:       what the chart is about, read by screen readers
import { useState } from "react";

// Fixed color order: part 1 always gets series-1, part 2 series-2, and so on.
// These five were checked with the dataviz palette script in dark and light mode.
const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];

export default function SegmentedBar({ items, formatValue, label }) {
  // Which block the mouse or keyboard is on (null = none).
  const [active, setActive] = useState(null);

  // Biggest part first, so the bar reads left to right from most to least.
  const parts = [...items].sort((a, b) => b.value - a.value).slice(0, COLORS.length);
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;

  return (
    <div className="segbar">
      <div className="segbar__bar" role="list" aria-label={label}>
        {parts.map((part, index) => {
          const share = Math.round((part.value / total) * 100);
          return (
            <div
              key={part.label}
              role="listitem"
              tabIndex={0}
              className={`segbar__part${active === index ? " is-active" : ""}`}
              style={{ flexGrow: part.value, background: COLORS[index] }}
              aria-label={`${part.label}: ${formatValue(part.value)}, ${share}% of the total`}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            >
              {/* The share is printed on the block only when the block is wide enough. */}
              {share >= 8 && <span className="segbar__share" aria-hidden="true">{share}%</span>}

              {/* The tooltip: value first (bold), then the name. */}
              {active === index && (
                <span className="chart-tooltip segbar__tooltip" aria-hidden="true">
                  <span className="chart-tooltip__row">
                    <strong>{formatValue(part.value)}</strong>
                    <span>{part.label} · {share}%</span>
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend: names only, so color is never the only way to tell parts apart. */}
      <ul className="chart-legend segbar__legend">
        {parts.map((part, index) => (
          <li key={part.label}>
            <span className="segbar__swatch" style={{ background: COLORS[index] }} aria-hidden="true" />
            {part.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
