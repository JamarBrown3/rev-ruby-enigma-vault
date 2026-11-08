// Slides for the home page slider.
//   title, text: what the slide says.
//   cta: the button. `to` can be a page ("/games") or a spot on this page ("#archive").
//   character: art shown on the right while there's no banner photo.
//   alt: what the art shows, read aloud by screen readers. Describe the picture,
//     don't repeat the title. Use "" only if the picture adds nothing.
//   image (optional): a full banner photo instead, e.g. "/images/banners/library.jpg"
//     (about 1600 x 700 px). The text sits on a dark shade so it stays readable.
export const SLIDES = [
  {
    title: "Notes from past the main quest",
    text: "Reviews, theories and conversations from players who check every corner of the map.",
    cta: { label: "Read the latest posts", to: "#archive" },
    character: "/images/slides/campfire.jpg",
    alt: "A campfire, sketchbook and treasure map on a cliff over a valley of waterfalls and ruins",
  },
  {
    title: "A library of games worth your time",
    text: "Every game in the vault, with the community's reviews and ratings out of 10.",
    cta: { label: "Browse the games", to: "/games" },
    character: "/images/slides/vault-library.jpg",
    alt: "A grand library of glowing game cartridges, discs and books around a giant ruby gem",
  },
  {
    title: "Need a website, a store or a dashboard?",
    text: "I build sites for small businesses, with dashboards that explain your numbers in plain English.",
    cta: { label: "See services", to: "/services" },
    character: "/images/slides/workshop.jpg",
    alt: "A desk at night with a floating online store, rising sales charts and a tiny model shop",
  },
];
