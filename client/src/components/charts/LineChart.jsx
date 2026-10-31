// Line chart for values over days (hand-made SVG, no chart library).
// Follows the dataviz rules: 2px lines, solid hairline grid, values at the
// line ends, a crosshair that snaps to the nearest day, one tooltip listing
// every series, and arrow-key support. Every number is also in the table view.
import { useState } from "react";
import useElementWidth from "../../hooks/useElementWidth.js";
import { longDate, niceTicks, shortDate } from "./scale.js";

const PLOT_HEIGHT = 230;
const X_AXIS = 30; // room under the plot for the date labels
const PAD = { top: 14, left: 52, right: 64 };

export default function LineChart({ dates, series, formatValue, formatTick = formatValue, label }) {
  const [ref, width] = useElementWidth();
  const [active, setActive] = useState(null); // index of the day under the pointer/keyboard
  const count = dates.length;

  const plotWidth = Math.max(width - PAD.left - PAD.right, 120);
  const maxValue = Math.max(1, ...series.flatMap((line) => line.values));
  const ticks = niceTicks(0, maxValue, 4);
  const top = ticks[ticks.length - 1];
  const x = (index) => PAD.left + (count === 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth);
  const y = (value) => PAD.top + PLOT_HEIGHT - (value / top) * PLOT_HEIGHT;
  const path = (values) => values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join("");

  // About one date label per 110px, always including the first and last day.
  const labelCount = Math.max(2, Math.min(6, Math.floor(plotWidth / 110)));
  const dateTicks = [...new Set(Array.from({ length: labelCount }, (_, i) => Math.round((i / (labelCount - 1)) * (count - 1))))];

  // End labels only when they won't collide (otherwise the legend and tooltip carry it).
  const ends = series.map((line) => ({ ...line, last: line.values[count - 1], endY: y(line.values[count - 1]) }));
  const endsCollide = ends.some((a, i) => ends.some((b, j) => i < j && Math.abs(a.endY - b.endY) < 16));

  function pick(event) {
    const box = event.currentTarget.getBoundingClientRect();
    const position = ((event.clientX - box.left) / box.width) * width;
    const index = Math.round(((position - PAD.left) / plotWidth) * (count - 1));
    setActive(Math.min(count - 1, Math.max(0, index)));
  }

  function onKeyDown(event) {
    const moves = { ArrowLeft: -1, ArrowRight: 1 };
    if (event.key in moves) {
      event.preventDefault();
      setActive((current) => Math.min(count - 1, Math.max(0, (current ?? count - 1) + moves[event.key])));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(count - 1);
    } else if (event.key === "Escape") {
      setActive(null);
    }
  }

  const tooltipLeft = active === null ? 0 : Math.min(Math.max(x(active) + 12, 8), width - 190);
  const readout =
    active === null
      ? ""
      : `${longDate(dates[active])}: ${series.map((line) => `${line.name} ${formatValue(line.values[active])}`).join(", ")}`;

  return (
    <div className="line-chart" ref={ref}>
      {series.length > 1 && (
        <ul className="chart-legend">
          {series.map((line) => (
            <li key={line.key}>
              <span className="chart-legend__line" style={{ background: line.color }} aria-hidden="true" />
              {line.name}
            </li>
          ))}
        </ul>
      )}

      <div
        className="line-chart__frame"
        tabIndex={0}
        role="group"
        aria-label={`${label}. Use the left and right arrow keys to read each day.`}
        onPointerMove={pick}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((current) => current ?? count - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        <svg width={width} height={PAD.top + PLOT_HEIGHT + X_AXIS} aria-hidden="true" focusable="false">
          {ticks.map((tick) => (
            <g key={tick}>
              <line className={tick === 0 ? "chart-axis" : "chart-gridline"} x1={PAD.left} x2={PAD.left + plotWidth} y1={y(tick)} y2={y(tick)} />
              <text className="chart-tick" x={PAD.left - 10} y={y(tick)} dy="0.32em" textAnchor="end">{formatTick(tick)}</text>
            </g>
          ))}

          {dateTicks.map((index) => (
            <text
              key={index}
              className="chart-tick"
              x={x(index)}
              y={PAD.top + PLOT_HEIGHT + 20}
              textAnchor={index === 0 ? "start" : index === count - 1 ? "end" : "middle"}
            >
              {shortDate(dates[index])}
            </text>
          ))}

          {series.map((line) => (
            <path key={line.key} d={path(line.values)} className="chart-line" style={{ stroke: line.color }} />
          ))}

          {ends.map((line) => (
            <g key={line.key}>
              <circle className="chart-dot" cx={x(count - 1)} cy={line.endY} r="4" style={{ fill: line.color }} />
              {!endsCollide && (
                <text className="chart-end-label" x={x(count - 1) + 10} y={line.endY} dy="0.32em">{formatValue(line.last)}</text>
              )}
            </g>
          ))}

          {active !== null && (
            <g>
              <line className="chart-crosshair" x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + PLOT_HEIGHT} />
              {series.map((line) => (
                <circle key={line.key} className="chart-dot" cx={x(active)} cy={y(line.values[active])} r="4.5" style={{ fill: line.color }} />
              ))}
            </g>
          )}
        </svg>

        {active !== null && (
          <div className="chart-tooltip" style={{ left: tooltipLeft, top: PAD.top }} aria-hidden="true">
            <p className="chart-tooltip__date">{longDate(dates[active])}</p>
            {series.map((line) => (
              <p key={line.key} className="chart-tooltip__row">
                <span className="chart-legend__line" style={{ background: line.color }} />
                <strong>{formatValue(line.values[active])}</strong>
                <span>{line.name}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite">{readout}</p>
    </div>
  );
}
