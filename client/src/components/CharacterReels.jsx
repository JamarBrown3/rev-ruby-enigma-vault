// The two character reels that frame every page.
//   Left reel: scrolls up, non-stop.   Right reel: scrolls down, non-stop.
//   Phones: the side reels don't fit, so one strip under the header scrolls sideways.
//
// How the endless loop works: the 5 cards are drawn 3 times in a row, and CSS
// slides the column by exactly one set (see .reel__track in layout.css). When
// the animation restarts, the picture is identical, so you never see a jump.
//
// Accessibility: the art is decorative (alt=""), and there's a Pause button
// because anything that moves on its own for more than 5 seconds needs one.
// People whose device is set to "reduce motion" start with the reels paused.
import { useState } from "react";
import { LEFT_REEL, REEL_SECONDS, RIGHT_REEL } from "../data/characters.js";
import prefersReducedMotion from "../hooks/prefersReducedMotion.js";
import { PauseIcon, PlayIcon } from "./Icons.jsx";

const STORAGE_KEY = "rev-reels-paused";
const COPIES = [0, 1, 2];

function startPaused() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return saved === "true";
  } catch {
    // Storage blocked: fall back to the device setting.
  }
  return prefersReducedMotion();
}

export default function CharacterReels() {
  const [paused, setPaused] = useState(startPaused);

  function toggle() {
    setPaused((wasPaused) => {
      const next = !wasPaused;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore: the button still works for this visit.
      }
      return next;
    });
  }

  const shared = { paused, onToggle: toggle };
  return (
    <>
      <Reel className="reel reel--left" direction="up" characters={LEFT_REEL} {...shared} />
      <Reel className="reel reel--right" direction="down" characters={RIGHT_REEL} {...shared} />
      <Reel className="reel reel--strip" direction="sideways" characters={LEFT_REEL} {...shared} />
    </>
  );
}

function Reel({ className, direction, characters, paused, onToggle }) {
  return (
    <div className={className}>
      <div className="reel__window">
        <div
          className={`reel__track reel__track--${direction}`}
          style={{ "--reel-seconds": `${REEL_SECONDS}s` }}
          data-paused={paused}
          aria-hidden="true"
        >
          {COPIES.flatMap((copy) =>
            characters.map((character, index) => (
              <figure className="reel__card" key={`${copy}-${index}`}>
                <img src={character.image} alt="" width="300" height="400" decoding="async" draggable="false" />
                <figcaption>{character.name}</figcaption>
              </figure>
            )),
          )}
        </div>
      </div>

      <button type="button" className="reel__control" onClick={onToggle} aria-pressed={paused}>
        {paused ? <PlayIcon width={14} height={14} /> : <PauseIcon width={14} height={14} />}
        <span>{paused ? "Play reels" : "Pause reels"}</span>
      </button>
    </div>
  );
}
