// Slides for the home page slider.
//   title, text: what the slide says.
//   cta: the button. `to` can be a page ("/games") or a spot on this page ("#archive").
//   character: art shown on the right while there's no banner photo.
//   image (optional): a full banner photo instead, e.g. "/images/banners/library.jpg"
//     (about 1600 x 700 px). The text sits on a dark shade so it stays readable.
export const SLIDES = [
  {
    title: "Notes from past the main quest",
    text: "Reviews, theories and conversations from players who check every corner of the map.",
    cta: { label: "Read the latest posts", to: "#archive" },
    character: "/characters/mage.svg",
  },
  {
    title: "A library of games worth your time",
    text: "Every game in the vault, with the community's reviews and ratings out of 10.",
    cta: { label: "Browse the games", to: "/games" },
    character: "/characters/pilot.svg",
  },
  {
    title: "Need a website, a store or a dashboard?",
    text: "I build sites for small businesses, with dashboards that explain your numbers in plain English.",
    cta: { label: "See services", to: "/services" },
    character: "/characters/ranger.svg",
  },
];
