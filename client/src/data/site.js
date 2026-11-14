// Public links only. The private response sheets never go in code.
// No email on purpose: clients use the form, so the inbox doesn't fill with spam.

export const CONTACT = {
  booking:
    "https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2eVBJKMK5iqLI6fRtO-dH2WxEWCEeru6fwf7beV3HlCLdItv3eALKgpmY0oMcHkYbd-qEw5_rv", // Google Calendar booking page (free 30-minute call)

  inquiryForm:
    "https://docs.google.com/forms/d/e/1FAIpQLSca23ChJ2eEFta-95MAH1zBvM2Mr1qeOinziFopxW0x2IW67w/viewform",

  linkedin: "https://www.linkedin.com/in/jamar-brown-8a7099324",
  github: "https://github.com/JamarBrown3",
};

// Real projects. `url` = live site, `code` = GitHub. Leave "" to hide a link.
export const PROJECTS = [
  {
    name: "REV, The Ruby Enigma Vault V1",
    stack: "React, Express, MongoDB, Argon2, CSRF",
    about:
      "This site: community posts, a game library, admin tools and dashboards, with logins, CSRF protection and Argon2 passwords.",
    url: "",
    code: "https://github.com/JamarBrown3/rev-ruby-enigma-vault",
  },
  {
    name: "JB Computer Parts",
    stack: "Node.js, Express, EJS, MongoDB, Argon2, CSRF",
    about:
      "An online store for PC parts with accounts, a shopping cart, search, filters and a weekly sale countdown.",
    url: "",
    code: "https://github.com/JamarBrown3/JB-Computer-Parts",
  },
  {
    name: "Video game store",
    stack: "React, Express, PostgreSQL",
    about:
      "Create a custom game: pick its genre, setting, platform and cover color, and watch the price and preview update as you choose.",
    url: "",
    code: "https://github.com/JamarBrown3/CodePath_Web103_Projects/tree/main/video_gameStore",
  },
  {
    name: "Xenoblade locations",
    stack: "React, Express, PostgreSQL",
    about:
      "Locations from Xenoblade Chronicles and the events held at each one, with live countdowns and a location filter.",
    url: "",
    code: "https://github.com/JamarBrown3/CodePath_Web103_Projects/tree/main/xenoblade1_Locations",
  },
  {
    name: "On the Fly",
    stack: "React, Express, PostgreSQL, OAuth",
    about:
      "A trip-planning app for organizing destinations and activities, built in CodePath's web development course. Uses GitHub sign-in.",
    url: "",
    code: "https://github.com/JamarBrown3/CodePath_Web103_Projects/tree/main/onthefly",
  },
];
// The skills grid on the About page. `code` is the short label on the ruby
// badge (no official logos, so nothing here needs a trademark license).
export const SKILLS = [
  {
    name: "React",
    code: "Rx",
    use: "Interfaces like this site, built from reusable components.",
  },
  {
    name: "Node.js",
    code: "Nd",
    use: "APIs and servers with Express, sessions and secure logins.",
  },
  {
    name: "MongoDB",
    code: "Mo",
    use: "REV's accounts, posts and games, through Mongoose.",
  },
  { name: "Python", code: "Py", use: "Cleaning, analyzing and charting data." },
  { name: "R", code: "R", use: "Statistics and data visualization." },
  { name: "SQL", code: "Sq", use: "Queries and reports in PostgreSQL." },
  {
    name: "Java",
    code: "Jv",
    use: "Object-oriented programming fundamentals.",
  },
];
