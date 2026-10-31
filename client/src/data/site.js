// Your contact links and portfolio projects, in one place.
// Leave a link as "" and its button simply won't show (no dead links).
export const CONTACT = {
  email: "", // e.g. "hello@yourdomain.com"
  linkedin: "", // e.g. "https://www.linkedin.com/in/your-name"
  github: "", // e.g. "https://github.com/your-name"
};

// Real projects. Add `url` (live site) or `code` (GitHub) when you have them.
export const PROJECTS = [
  {
    name: "REV, The Ruby Enigma Vault",
    stack: "React, Express, MongoDB",
    about: "This site: community posts, a game library, admin tools and dashboards, with logins, CSRF protection and Argon2 passwords.",
    url: "",
    code: "",
  },
  {
    name: "JB Computer Parts",
    stack: "Node, Express, EJS, MongoDB",
    about: "An online store for PC parts with accounts, a shopping cart, search, filters and a weekly sale countdown. Built for CIS485 at BMCC.",
    url: "",
    code: "",
  },
  {
    name: "Video game store",
    stack: "React, Express, PostgreSQL",
    about: "Create a custom game: pick its genre, setting, platform and cover color, and watch the price and preview update as you choose.",
    url: "",
    code: "",
  },
  {
    name: "Xenoblade locations",
    stack: "React, Express, PostgreSQL",
    about: "Locations from Xenoblade Chronicles and the events held at each one, with live countdowns and a location filter.",
    url: "",
    code: "",
  },
  {
    name: "On the Fly",
    stack: "Express, PostgreSQL",
    about: "A trip-planning app for organizing destinations and activities, built in CodePath's web development course.",
    url: "",
    code: "",
  },
];

// The skills grid on the About page. `code` is the short label on the ruby
// badge (no official logos, so nothing here needs a trademark license).
export const SKILLS = [
  { name: "React", code: "Rx", use: "Interfaces like this site, built from reusable components." },
  { name: "Node.js", code: "Nd", use: "APIs and servers with Express, sessions and secure logins." },
  { name: "MongoDB", code: "Mo", use: "REV's accounts, posts and games, through Mongoose." },
  { name: "Python", code: "Py", use: "Cleaning, analyzing and charting data." },
  { name: "R", code: "R", use: "Statistics and data visualization." },
  { name: "SQL", code: "Sq", use: "Queries and reports in PostgreSQL." },
  { name: "Java", code: "Jv", use: "Object-oriented programming fundamentals." },
];
