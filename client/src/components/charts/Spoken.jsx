// Numbers that screen readers read correctly.
// Sighted visitors see "$1,956"; screen readers hear "one thousand nine hundred
// fifty-six dollars". The visible text is aria-hidden so it isn't read twice.
import { fullNumber, money, sayMoney, sayNumber } from "./scale.js";

export function Spoken({ text, say }) {
  return (
    <>
      <span aria-hidden="true">{text}</span>
      <span className="visually-hidden">{say}</span>
    </>
  );
}

// <Money value={1956} /> shows "$1,956". Add `cents` for "$42.50".
export function Money({ value, cents = false }) {
  return <Spoken text={money(value, { cents })} say={sayMoney(value, { cents })} />;
}

// <Count value={1284} /> shows "1,284".
export function Count({ value }) {
  return <Spoken text={fullNumber(value)} say={sayNumber(value)} />;
}

// A sentence with amounts inside it, like "Sales were $11,930 from 1,423 orders."
// Each "$11,930" or "1,423" gets spoken words; the rest of the sentence is unchanged.
const AMOUNT = /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})+\b/g;

export function SpokenSentence({ text }) {
  const pieces = [];
  let last = 0;
  for (const match of text.matchAll(AMOUNT)) {
    pieces.push(text.slice(last, match.index));
    const shown = match[0];
    const number = Number(shown.replace(/[$,]/g, ""));
    const say = shown.startsWith("$") ? sayMoney(number, { cents: shown.includes(".") }) : sayNumber(number);
    pieces.push(<Spoken key={match.index} text={shown} say={say} />);
    last = match.index + shown.length;
  }
  pieces.push(text.slice(last));
  return <>{pieces}</>;
}
