// One headline number with its change from the period before.
//   change: a fraction (0.12 = 12% more). goodWhenUp: is "more" good news?
// The arrow and the words carry the direction, so it never relies on color alone.
import { TrendDown, TrendUp } from "../Icons.jsx";

export default function StatTile({ label, value, change, period, goodWhenUp = true, note }) {
  let delta = note ? <p className="stat__delta">{note}</p> : null;
  if (!note && typeof change === "number" && Number.isFinite(change)) {
    const percent = Math.round(Math.abs(change) * 100);
    if (percent === 0) {
      delta = <p className="stat__delta">About the same as {period}</p>;
    } else {
      const up = change > 0;
      const good = up === goodWhenUp;
      delta = (
        <p className="stat__delta">
          <span className={good ? "stat__icon stat__icon--good" : "stat__icon stat__icon--bad"}>
            {up ? <TrendUp width={16} height={16} /> : <TrendDown width={16} height={16} />}
          </span>
          {percent}% {up ? "more" : "less"} than {period}
        </p>
      );
    }
  }

  return (
    <div className="stat">
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
      {delta}
    </div>
  );
}
