// A ruby gem: the gem shape is a mask, and ruby_gem.png shows through it.
// Decorative only, so screen readers skip it.
// shape: "gem" (cut ruby) or "diamond" (the logo).
export default function Ruby({ size = 24, shape = "gem" }) {
  return (
    <span
      className={`ruby ruby--${shape}`}
      style={{ "--ruby-size": `${size}px` }}
      aria-hidden="true"
    />
  );
}
