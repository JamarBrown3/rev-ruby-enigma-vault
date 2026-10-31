// Home page slider. It works like the Nivo slider from my CIS485 store
// (fade between slides, caption on the slide, arrows, dots, auto-advance that
// pauses on hover) but rebuilt in React with no jQuery and no template files.
// Added on top: swipe on phones, arrow keys, a Pause button, and it starts
// paused for people who turned on "reduce motion".
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import prefersReducedMotion from "../hooks/prefersReducedMotion.js";
import { ChevronLeft, ChevronRight, PauseIcon, PlayIcon } from "./Icons.jsx";

const SWIPE_DISTANCE = 40; // px a finger must travel to count as a swipe

export default function VaultSlider({ slides, label = "Featured", interval = 6500 }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [held, setHeld] = useState(false); // pointer or keyboard focus is inside
  const swipeStart = useRef(null);
  const count = slides.length;

  // Wrap around: after the last slide comes the first (and the other way).
  const goTo = useCallback((next) => setIndex(((next % count) + count) % count), [count]);

  // Auto-advance, like Nivo's pauseTime. Stops while held or paused.
  useEffect(() => {
    if (!playing || held || count < 2) return undefined;
    const timer = setTimeout(() => goTo(index + 1), interval);
    return () => clearTimeout(timer);
  }, [index, playing, held, count, interval, goTo]);

  function onKeyDown(event) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(index - 1);
    }
  }

  function onPointerUp(event) {
    if (swipeStart.current === null) return;
    const distance = event.clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(distance) >= SWIPE_DISTANCE) goTo(index + (distance < 0 ? 1 : -1));
  }

  return (
    <section
      className="slider"
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
      }}
    >
      <div
        className="slider__viewport"
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse") swipeStart.current = event.clientX;
        }}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
      >
        {slides.map((slide, i) => {
          const active = i === index;
          return (
            <div
              key={slide.title}
              className={`slide${active ? " is-active" : ""}${slide.image ? " slide--photo" : ""}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={!active}
              inert={!active}
              style={slide.image ? { backgroundImage: `url("${slide.image}")` } : undefined}
            >
              <div className="slide__copy">
                <h2 className="slide__title">{slide.title}</h2>
                <p className="slide__text">{slide.text}</p>
                {slide.cta && <SlideLink cta={slide.cta} />}
              </div>
              {!slide.image && slide.character && (
                <img className="slide__art" src={slide.character} alt="" width="300" height="400" />
              )}
            </div>
          );
        })}
      </div>

      <div className="slider__controls">
        <button type="button" className="icon-button" onClick={() => goTo(index - 1)} aria-label="Previous slide">
          <ChevronLeft />
        </button>
        <div className="slider__dots">
          {slides.map((slide, i) => (
            <button
              key={slide.title}
              type="button"
              className="slider__dot"
              aria-label={`Slide ${i + 1}: ${slide.title}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <span className="slider__count" aria-hidden="true">
          {index + 1} / {count}
        </span>
        <button type="button" className="icon-button" onClick={() => goTo(index + 1)} aria-label="Next slide">
          <ChevronRight />
        </button>
        <button
          type="button"
          className="icon-button slider__play"
          onClick={() => setPlaying((on) => !on)}
          aria-label={playing ? "Pause slideshow" : "Play slideshow"}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>
    </section>
  );
}

// "#archive" scrolls on this page; "/games" opens another page.
function SlideLink({ cta }) {
  if (cta.to.startsWith("#")) {
    return (
      <a className="button button--primary" href={cta.to}>
        {cta.label}
      </a>
    );
  }
  return (
    <Link className="button button--primary" to={cta.to}>
      {cta.label}
    </Link>
  );
}
