// Screen-reader numbers: VoiceOver misread "$1,956" as about one dollar,
// so tables and the summary give screen readers the amount in words.
import { describe, test, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { sayMoney, sayNumber } from "./scale.js";
import { Count, Money, SpokenSentence } from "./Spoken.jsx";
import ChartCard from "./ChartCard.jsx";

describe("sayNumber and sayMoney", () => {
  test("whole numbers become words", () => {
    expect(sayNumber(0)).toBe("zero");
    expect(sayNumber(7)).toBe("seven");
    expect(sayNumber(42)).toBe("forty-two");
    expect(sayNumber(100)).toBe("one hundred");
    expect(sayNumber(236)).toBe("two hundred thirty-six");
    expect(sayNumber(1956)).toBe("one thousand nine hundred fifty-six");
    expect(sayNumber(3000)).toBe("three thousand");
    expect(sayNumber(126566)).toBe("one hundred twenty-six thousand five hundred sixty-six");
    expect(sayNumber(2_000_015)).toBe("two million fifteen");
  });

  test("money says dollars, and cents only when asked", () => {
    expect(sayMoney(1956)).toBe("one thousand nine hundred fifty-six dollars");
    expect(sayMoney(1)).toBe("one dollar");
    expect(sayMoney(8.38, { cents: true })).toBe("eight dollars and thirty-eight cents");
    expect(sayMoney(42.01, { cents: true })).toBe("forty-two dollars and one cent");
    expect(sayMoney(42, { cents: true })).toBe("forty-two dollars");
    expect(sayMoney(19.999, { cents: true })).toBe("twenty dollars");
  });
});

describe("Money, Count and SpokenSentence", () => {
  test("sighted visitors see digits; screen readers get words, not both", () => {
    const { container } = render(<p><Money value={1956} /> from <Count value={236} /> orders</p>);
    expect(screen.getByText("$1,956")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("one thousand nine hundred fifty-six dollars")).toHaveClass("visually-hidden");
    expect(screen.getByText("two hundred thirty-six")).toHaveClass("visually-hidden");
    expect(container.textContent).toContain("$1,956");
  });

  test("amounts inside a sentence are spoken; the words around them stay", () => {
    const sentence = "Sales were $11,930 this week, from 1,423 orders at roughly the same $8.38 average.";
    const { container } = render(<p><SpokenSentence text={sentence} /></p>);
    expect(screen.getByText("eleven thousand nine hundred thirty dollars")).toBeInTheDocument();
    expect(screen.getByText("one thousand four hundred twenty-three")).toBeInTheDocument();
    expect(screen.getByText("eight dollars and thirty-eight cents")).toBeInTheDocument();
    // What a sighted visitor reads is unchanged.
    const visible = [...container.querySelectorAll('[aria-hidden="true"]')].map((el) => el.textContent);
    expect(visible).toEqual(["$11,930", "1,423", "$8.38"]);
  });

  test("percent and small numbers are left alone", () => {
    const { container } = render(<p><SpokenSentence text="61% of customers, up from 57%." /></p>);
    expect(container.querySelector(".visually-hidden")).toBeNull();
  });

  test("a chart's table reads the words in its cells", async () => {
    render(
      <ChartCard title="Daily sales" columns={["Day", "Sales", "Orders"]} rows={[["Sat, Sep 26", <Money value={1956} />, <Count value={236} />]]}>
        <p>chart</p>
      </ChartCard>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show table" }));
    const table = screen.getByRole("table", { name: "Daily sales" });
    const [sales, orders] = within(table).getAllByRole("cell");
    expect(sales).toHaveAccessibleName("one thousand nine hundred fifty-six dollars");
    expect(orders).toHaveAccessibleName("two hundred thirty-six");
  });
});
