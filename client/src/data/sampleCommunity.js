// SAMPLE numbers for the admin dashboard, until the admin stats routes exist
// (the plan: GET /api/admin/stats, computed from users, posts and games).
// Seeded, so they're identical on every visit and the summaries match.
// The "Newest posts" table on the dashboard is NOT sample: it's live.

export const PERIOD_END = new Date(2026, 9, 25); // Sunday, October 25, 2026
const HISTORY_DAYS = 180;

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Daily counts that grow slowly, with busier weekends and one spike
// (a post that got shared around on Saturday, Oct 10).
function buildHistory() {
  const random = seeded(2026);
  const days = [];
  for (let i = 0; i < HISTORY_DAYS; i += 1) {
    const date = new Date(PERIOD_END);
    date.setDate(PERIOD_END.getDate() - (HISTORY_DAYS - 1 - i));
    const growth = 1 + i / HISTORY_DAYS; // about twice as busy as six months ago
    const weekend = [0, 6].includes(date.getDay()) ? 1.35 : 1;
    const spike = i === HISTORY_DAYS - 16 ? 3.2 : 1; // Oct 10
    const count = (base) => Math.max(0, Math.round(base * growth * weekend * spike * (0.6 + random() * 0.8)));
    days.push({ date, discussions: count(2.6), reviews: count(1.2), members: count(1.8) });
  }
  return days;
}

const HISTORY = buildHistory();
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const change = (now, before) => (before ? (now - before) / before : 0);

const PLATFORM_SHARES = [
  ["PC", 0.34],
  ["PlayStation 5", 0.24],
  ["Nintendo Switch", 0.22],
  ["Xbox Series X|S", 0.12],
  ["Steam Deck", 0.08],
];

export const GAMES_IN_LIBRARY = { total: 48, added: { 7: 2, 30: 6, 90: 15 } };

// Invented titles, clearly sample: real data will come from the reviews.
export const TOP_RATED = [
  { title: "Lantern Hollow", rating: 9.1, reviews: 23 },
  { title: "Starfall Circuit", rating: 8.8, reviews: 31 },
  { title: "Rune Courier", rating: 8.6, reviews: 17 },
  { title: "Deep Tide", rating: 8.4, reviews: 26 },
  { title: "Clockwork Saints", rating: 8.2, reviews: 12 },
];

export function communityView(range) {
  const days = HISTORY.slice(-range);
  const before = HISTORY.slice(-2 * range, -range);
  const reviews = sum(days, "reviews");
  const random = seeded(range);

  // Split the reviews across platforms (rounded, then fixed so they add up).
  const platforms = PLATFORM_SHARES.map(([label, share]) => ({ label, value: Math.round(reviews * (share + (random() - 0.5) * 0.02)) }));
  platforms[0].value += reviews - platforms.reduce((total, item) => total + item.value, 0);

  return {
    days,
    totals: {
      posts: sum(days, "discussions") + sum(days, "reviews"),
      reviews,
      members: sum(days, "members"),
    },
    changes: {
      posts: change(sum(days, "discussions") + sum(days, "reviews"), sum(before, "discussions") + sum(before, "reviews")),
      reviews: change(reviews, sum(before, "reviews")),
      members: change(sum(days, "members"), sum(before, "members")),
    },
    platforms: platforms.sort((a, b) => b.value - a.value),
    summary: SUMMARIES[range],
  };
}

// Written by Claude from the sample numbers above (the server will write these
// from real numbers later, using the AI budget).
const SUMMARIES = {
  7: [
    "The vault got 58 new posts this week, 19 of them reviews, a little below last week's pace.",
    "28 people joined, the same as last week, and Sunday, Oct 25 was the busiest day with 11 new posts.",
    "PC games drew the most reviews (7 of 19), and 2 new games were added to the library.",
  ],
  30: [
    "The last 30 days brought 268 new posts and 126 new members, both up more than 20% from the month before.",
    "Saturday, Oct 10 was the busiest day by far, with 27 posts and 10 new members, so it's worth checking which post brought people in.",
    "Weekends are when people post most: about 12 posts a day, against 7 or 8 on weekdays.",
  ],
  90: [
    "Over the last 90 days the community posted 670 times, 41% more than in the 90 days before.",
    "Reviews grew fastest, up 54% to 222, and 326 new members joined, up 49%.",
    "15 games were added in that time, and PC, PlayStation 5 and Switch games got about four in five of all reviews.",
  ],
};
