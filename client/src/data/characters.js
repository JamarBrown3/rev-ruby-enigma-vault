// The 5 characters in the side reels (and the slider art on the home page).
//
// TO USE YOUR OWN IMAGES:
//   1. Put the files in client/public/characters/ (for example knight.webp).
//   2. Change `image` below to "/characters/knight.webp" (and `name` if you like).
// Tall portrait images look best: about 600 x 800 px, under 300 KB each
// (.webp or .png). For a commercial site, use art you made, bought or have
// permission to use; official game art usually belongs to the publisher.
export const CHARACTERS = [
  { name: "The knight", image: "/characters/knight.svg" },
  { name: "Forest mage", image: "/characters/mage.svg" },
  { name: "Vault ranger", image: "/characters/ranger.svg" },
  { name: "Arcade pilot", image: "/characters/pilot.svg" },
  { name: "Ruby rogue", image: "/characters/rogue.svg" },
];

// The left reel scrolls up and the right reel scrolls down. The right one
// starts on a different character so the two sides never mirror each other.
export const LEFT_REEL = CHARACTERS;
export const RIGHT_REEL = [...CHARACTERS.slice(2), ...CHARACTERS.slice(0, 2)];

// Seconds for one full trip through the 5 characters. Bigger = slower.
export const REEL_SECONDS = 40;
