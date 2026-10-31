// REV mark: a cut gem with an R, from the wireframe's diamond logo.
export default function Logo({ size = 42 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path className="logo__gem" d="M24 2.5 45.5 24 24 45.5 2.5 24Z" />
      <path className="logo__facet" d="M24 2.5 34 24 24 45.5 14 24Z" />
      <text className="logo__letter" x="24" y="31.5" textAnchor="middle">R</text>
    </svg>
  );
}
