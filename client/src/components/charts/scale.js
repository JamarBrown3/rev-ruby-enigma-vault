// Math and formatting shared by the charts.

// Round axis ticks: niceTicks(0, 1834, 4) -> [0, 500, 1000, 1500, 2000]
export function niceTicks(min, max, count = 4) {
  if (max <= min) return [min, min + 1];
  const rough = (max - min) / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((candidate) => candidate >= rough) ?? 10 * power;
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let value = start; value < max + step * 0.999; value += step) ticks.push(Number(value.toFixed(10)));
  return ticks;
}

// 1,284 / 12.9K / 4.2M
export function compactNumber(value) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function fullNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function money(value, { compact = false, cents = false } = {}) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : cents ? 2 : 0,
    minimumFractionDigits: cents && !compact ? 2 : 0,
  }).format(value);
}

// Numbers in words, for screen readers: 1956 -> "one thousand nine hundred fifty-six".
// VoiceOver misread "$1,956" as about one dollar, so tables give screen readers
// the words instead. Words can't be misread by any voice or setting.
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES = [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];

function underThousand(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
  const rest = n % 100;
  return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` ${underThousand(rest)}` : ""}`;
}

export function sayNumber(value) {
  let n = Math.round(Math.abs(value));
  if (n === 0) return "zero";
  const parts = [];
  for (const [size, name] of SCALES) {
    if (n >= size) {
      parts.push(`${underThousand(Math.floor(n / size))} ${name}`);
      n %= size;
    }
  }
  if (n) parts.push(underThousand(n));
  return (value < 0 ? "minus " : "") + parts.join(" ");
}

// 1956 -> "one thousand nine hundred fifty-six dollars"
// 42.5 with cents -> "forty-two dollars and fifty cents"
export function sayMoney(value, { cents = false } = {}) {
  const total = Math.round(Math.abs(value) * (cents ? 100 : 1));
  const dollars = cents ? Math.floor(total / 100) : total;
  const change = cents ? total % 100 : 0;
  let text = `${sayNumber(dollars)} ${dollars === 1 ? "dollar" : "dollars"}`;
  if (change) text += ` and ${sayNumber(change)} ${change === 1 ? "cent" : "cents"}`;
  return (value < 0 ? "minus " : "") + text;
}

export function shortDate(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function longDate(date) {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
