// Original REV mascots used by the character reels.
// Add more entries here and place their images in public/characters/.
export const CHARACTERS = [
  { name: "The Vault Keeper", image: "/characters/vault-keeper.jpg" },
  { name: "The Data Witch", image: "/characters/data-witch.jpg" },
  { name: "The Code Runner", image: "/characters/code-runner.jpg" },
  { name: "The Shop Golem", image: "/characters/shop-golem.jpg" },
  { name: "The Pixel Bard", image: "/characters/pixel-bard.jpg" },
  { name: "The Night Analyst", image: "/characters/night-analyst.jpg" },
];

// The left reel scrolls up and the right reel scrolls down. The right one
// starts on a different character so the two sides never mirror each other.
export const LEFT_REEL = CHARACTERS;
export const RIGHT_REEL = [...CHARACTERS.slice(2), ...CHARACTERS.slice(0, 2)];

// Seconds for one full trip through the character lineup. Bigger = slower.
export const REEL_SECONDS = 40;
