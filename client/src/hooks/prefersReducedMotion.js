// True when the visitor asked their device for less motion (macOS: System
// Settings > Accessibility > Display > Reduce motion). Moving things start paused.
export default function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
