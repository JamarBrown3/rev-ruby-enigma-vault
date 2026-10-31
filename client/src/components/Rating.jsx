import { GemIcon } from "./Icons.jsx";

// "8/10" with a small ruby. `recommend` is optional (true, false or undefined).
export default function Rating({ value, recommend }) {
  if (typeof value !== "number") return null;
  return (
    <span className="rating-group">
      <span className="rating">
        <GemIcon width={16} height={16} />
        <span>
          {value}
          <span className="rating__out-of">/10</span>
          <span className="visually-hidden"> rating</span>
        </span>
      </span>
      {recommend === true && <span className="recommend">Recommends it</span>}
      {recommend === false && <span className="recommend">Doesn't recommend it</span>}
    </span>
  );
}
