import { useEffect, useRef, useState } from "react";

// Measures an element's width and updates when it resizes (charts use this to
// redraw at the right size). Returns [ref, width].
export default function useElementWidth(initial = 600) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initial);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    setWidth(element.clientWidth || initial);
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [initial]);

  return [ref, width];
}
