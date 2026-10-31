// Made-up numbers for the member dashboard: three pretend small businesses.
// They come from a fixed seed, so they're the same on every visit and the
// saved summaries at the bottom always match them. If you change anything in
// BUSINESSES or the generator, rewrite the summaries too.
//
// On a real client site these numbers come from the client's store (Shopify,
// Square, a spreadsheet...) and the server writes the summary each day with
// the AI budget in server/services/aiUsageService.js.

export const PERIOD_END = new Date(2026, 9, 25); // Sunday, October 25, 2026 (months count from 0)
const HISTORY_DAYS = 60;

// Tiny seeded random number generator (mulberry32): same seed, same numbers.
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

export const BUSINESSES = {
  coffee: {
    name: "Corner coffee shop",
    seed: 11,
    dailyRevenue: 1450,
    dailyGrowth: 0.0022,
    averageOrder: 8.4,
    weekday: [1.2, 0.86, 0.9, 0.93, 0.96, 1.04, 1.27], // Sunday ... Saturday
    events: [],
    categories: { "Espresso drinks": 0.38, "Drip coffee": 0.17, Pastries: 0.22, "Cold drinks": 0.15, "Beans and merch": 0.08 },
    // How the mix moved in each range (fall is here: fewer cold drinks).
    shifts: {
      7: { "Cold drinks": -0.06, "Espresso drinks": 0.035, "Drip coffee": 0.025 },
      30: { "Cold drinks": -0.035, "Espresso drinks": 0.02, "Drip coffee": 0.015 },
    },
    returning: { 7: [0.6, 0.63], 30: [0.57, 0.61] }, // [period before, this period]
  },
  games: {
    name: "Online game store",
    seed: 23,
    dailyRevenue: 3200,
    dailyGrowth: 0.0035,
    averageOrder: 46,
    weekday: [1.16, 0.84, 0.87, 0.9, 0.95, 1.13, 1.21],
    events: [{ from: 44, to: 47, lift: 1.85 }], // a 4-day fall sale, Oct 10 to Oct 13
    categories: { Games: 0.46, Consoles: 0.21, Accessories: 0.17, Collectibles: 0.1, "Gift cards": 0.06 },
    shifts: {
      7: { "Gift cards": 0.025, Collectibles: 0.015, Consoles: -0.04 }, // early holiday shopping
      30: { Games: 0.03, Consoles: -0.02, "Gift cards": -0.01 }, // the sale was mostly games
    },
    returning: { 7: [0.33, 0.36], 30: [0.31, 0.34] },
  },
  bakery: {
    name: "Neighborhood bakery",
    seed: 37,
    dailyRevenue: 980,
    dailyGrowth: -0.0012,
    averageOrder: 14.5,
    weekday: [1.15, 0, 0.84, 0.87, 0.92, 1.12, 1.48], // closed on Mondays
    events: [{ from: 51, to: 51, lift: 1.7 }], // one big catering order, Saturday Oct 17
    categories: { Bread: 0.3, Pastries: 0.27, Cakes: 0.18, Cookies: 0.12, Catering: 0.13 },
    shifts: {
      7: { Catering: -0.04, Bread: 0.02, Pastries: 0.02 }, // no catering order this week
      30: { Catering: 0.03, Bread: -0.015, Cookies: -0.015 }, // includes the Oct 17 order
    },
    returning: { 7: [0.55, 0.52], 30: [0.54, 0.53] },
  },
};

function buildHistory(business) {
  const random = seeded(business.seed);
  const days = [];
  for (let i = 0; i < HISTORY_DAYS; i += 1) {
    const date = new Date(PERIOD_END);
    date.setDate(PERIOD_END.getDate() - (HISTORY_DAYS - 1 - i));
    const event = business.events.find((item) => i >= item.from && i <= item.to);
    const noise = 0.92 + random() * 0.16;
    const revenue =
      business.dailyRevenue *
      (1 + business.dailyGrowth) ** i *
      business.weekday[date.getDay()] *
      (event ? event.lift : 1) *
      noise;
    const orderSize = business.averageOrder * (0.95 + random() * 0.1);
    days.push({ date, revenue: Math.round(revenue), orders: revenue > 0 ? Math.round(revenue / orderSize) : 0 });
  }
  return days;
}

const HISTORIES = Object.fromEntries(Object.entries(BUSINESSES).map(([key, business]) => [key, buildHistory(business)]));

const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const change = (now, before) => (before ? (now - before) / before : 0);

function categoryMix(business, range) {
  const random = seeded(business.seed + range);
  const shift = business.shifts[range];
  const raw = Object.entries(business.categories).map(([label, share]) => [
    label,
    Math.max(0.01, share + (shift[label] ?? 0) + (random() - 0.5) * 0.01),
  ]);
  const total = raw.reduce((acc, [, share]) => acc + share, 0);
  return raw.map(([label, share]) => [label, share / total]);
}

// Everything the dashboard needs for one business and one date range (7 or 30 days).
export function businessView(key, range) {
  const business = BUSINESSES[key];
  const history = HISTORIES[key];
  const days = history.slice(-range);
  const before = history.slice(-2 * range, -range);

  const revenue = sum(days, "revenue");
  const orders = sum(days, "orders");
  const revenueBefore = sum(before, "revenue");
  const ordersBefore = sum(before, "orders");
  const [returningBefore, returning] = business.returning[range];

  return {
    name: business.name,
    days,
    totals: {
      revenue,
      orders,
      averageOrder: orders ? revenue / orders : 0,
      returning,
    },
    changes: {
      revenue: change(revenue, revenueBefore),
      orders: change(orders, ordersBefore),
      averageOrder: change(orders ? revenue / orders : 0, ordersBefore ? revenueBefore / ordersBefore : 0),
      returning: change(returning, returningBefore),
    },
    // Average sales for each day of the week (a day the shop is closed shows $0).
    weekdays: WEEKDAYS.map((weekday) => {
      const matching = days.filter((day) => day.date.getDay() === weekday);
      return {
        label: WEEKDAY_NAMES[weekday],
        value: matching.length ? Math.round(sum(matching, "revenue") / matching.length) : 0,
      };
    }),
    categories: categoryMix(business, range)
      .map(([label, share]) => ({ label, value: Math.round(revenue * share) }))
      .sort((a, b) => b.value - a.value),
    summary: SUMMARIES[key][range],
  };
}

// Three plain-English sentences per business and range, written by Claude
// from the numbers above (the same job the server's AI call will do for real
// clients). Saved here so the demo costs nothing per click.
const SUMMARIES = {
  coffee: {
    7: [
      "Sales were $11,930 this week, about 2% more than last week, from 1,423 orders at roughly the same $8.38 average.",
      "Saturday, Oct 24 was your best day of the month at $2,179, and weekends now bring in about a quarter more per day than weekdays.",
      "Cold drinks fell to 9% of sales as fall set in while espresso drinks grew to 41%, so a warm drink special may sell better than a cold one.",
    ],
    30: [
      "The last 30 days brought in $49,305, 7% more than the 30 days before, mostly from more orders (5,845, up 6%) rather than bigger ones.",
      "Saturdays are your strongest day at about $2,010 on average, and Mondays are the slowest at about $1,410.",
      "61% of customers were returning ones, up from 57%, so your regulars are coming back more often.",
    ],
  },
  games: {
    7: [
      "Sales were $26,181 this week, 21% lower than last week, but last week still had the final two days of your fall sale.",
      "A normal week before the sale was about $25,600, so this week is right on track, with 565 orders at the usual $46 average.",
      "Gift cards rose to 8% of sales, which often means holiday shopping is starting, so this is a good time to feature them.",
    ],
    30: [
      "The last 30 days brought in $126,566, 22% more than the 30 days before, with orders up by about the same amount.",
      "The fall sale from Oct 10 to Oct 13 drove most of that: those four days made $28,613, almost a quarter of the month, and Saturday, Oct 10 was the best day at $8,628.",
      "Games were nearly half of all sales, and 34% of customers were returning ones, up from 31%.",
    ],
  },
  bakery: {
    7: [
      "Sales were $5,610 this week, 16% lower than last week, but last week included a large catering order on Saturday, Oct 17.",
      "Leaving that order out, this week was only about 3% lower, so everyday business is steady.",
      "Saturday was again your busiest day at $1,249, and returning customers slipped to 52% from 55%, which is worth watching.",
    ],
    30: [
      "The last 30 days brought in $26,414, about the same as the 30 days before, from 1,822 orders.",
      "The best day was Saturday, Oct 17 at $2,165 thanks to a catering order, and catering made up 16% of the month's sales.",
      "Saturdays bring in nearly twice what Tuesdays do (about $1,480 against $780), so Saturday is the day to bake the most.",
    ],
  },
};
