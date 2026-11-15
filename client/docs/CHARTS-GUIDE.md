# REV Charts Guide

How to build your own dashboard charts in React, starting from zero.

- **Part 1: React basics.** The 5 ideas you need. Start here.
- **Part 2: Build charts.** Step by step: copy, paste, change.
- **Part 3: Advanced.** Filters, tooltips, colors.

You already know the data side. This guide is only about the React side.

---

# PART 1: React basics (the 5 ideas)

You only need these 5 things to build every chart on the dashboard.

## Idea 1: A component is a function that returns HTML

```jsx
function Hello() {
  return <h1>Hi Jah</h1>;
}
```

- The name starts with a **capital letter**.
- It **returns** what shows on the screen.
- You use it like an HTML tag: `<Hello />`

That's all a component is. `LineChart`, `BarChart` and `Dashboard` are all just this.

## Idea 2: JSX is HTML inside JavaScript

The HTML-looking code is called **JSX**. Two differences from normal HTML:

| Normal HTML | JSX |
|---|---|
| `class="title"` | `className="title"` |
| Text only | Put JavaScript inside `{ }` |

```jsx
const name = "Jah";
return <h1>Hi {name}</h1>;      // shows: Hi Jah
return <p>{2 + 2}</p>;          // shows: 4
```

**Rule: curly braces `{ }` mean "this part is JavaScript."**

## Idea 3: Props are the inputs you hand to a component

Props are like the parameters of a function.

```jsx
function Greeting({ name }) {          // the component receives "name"
  return <h1>Hi {name}</h1>;
}

<Greeting name="Jah" />                // you hand it "Jah"
<Greeting name="Sam" />                // same component, different input
```

Every chart works this way. You hand it data through props, and it draws:

```jsx
<BarChart items={myData} label="Sales" />
//        ^^^^^ prop      ^^^^^ prop
```

## Idea 4: `.map()` turns a list of data into a list of things on screen

You know this one from data work. In React, it's how you draw one thing per item.

```jsx
const games = ["Xenoblade", "Psychonauts", "Halo"];

return (
  <ul>
    {games.map((game) => <li key={game}>{game}</li>)}
  </ul>
);
```

- `.map()` runs once per item.
- Each item needs a **`key`** that's unique (React uses it to keep track).

You'll also use `.map()` to **reshape data** for a chart:

```jsx
// view.days looks like: [{ date, revenue, orders }, ...]
view.days.map((day) => day.orders)   // → [42, 51, 38, ...]  just the orders
```

## Idea 5: `useState` is memory that redraws the screen

Normal variables reset every time the screen redraws. `useState` remembers.

```jsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);   // start at 0

  return (
    <button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  );
}
```

- `count` is the current value.
- `setCount(...)` changes it **and redraws the screen**.
- `useState(0)` sets the starting value.

This is the secret behind filters **and** tooltips. You'll see it again in Part 3.

**That's all of Part 1. Those 5 ideas are all the React you need for charts.**

---

# PART 2: Build charts, step by step

## The files you'll touch

| File | What it is |
|---|---|
| `src/pages/Dashboard.jsx` | **The page.** You add charts here. |
| `src/data/sampleBusiness.js` | Makes the fake numbers. Gives you `view`. |
| `src/components/charts/` | The chart components. You use them; you don't have to edit them. |

## Step 1: Know what data you have

Inside `Dashboard.jsx` there's one variable with all the data, called **`view`**:

| What | What's inside |
|---|---|
| `view.name` | The business name, like "Corner coffee shop" |
| `view.days` | One item per day: `{ date, revenue, orders }` |
| `view.categories` | `[{ label: "Pastries", value: 1200 }, ...]` |
| `view.weekdays` | `[{ label: "Mon", value: 900 }, ...]` |
| `view.totals` | Big numbers: `revenue`, `orders`, `averageOrder`, `returning` |
| `view.changes` | How much each total changed: `0.12` = 12% more |

## Step 2: Pick the chart

| Your question | Chart |
|---|---|
| How did a number change over days? | **Line chart** |
| Which category is biggest? | **Bar chart** |
| How does the whole split into pieces? | **Segmented bar** (REV's pie chart) |
| What's the one number that matters? | **Stat tile** |

> **Why no round pie?** People can't tell whether a slice is 18% or 22% by looking at
> the angle. A segmented bar puts the same slices side by side as lengths, which are
> easy to compare. Same job, easier to read.

## Step 3: Every chart is the same sandwich

```jsx
<ChartCard title="..." subtitle="..." columns={[...]} rows={[...]}>   ← top bread
  <TheChart ... />                                                     ← the filling
</ChartCard>                                                           ← bottom bread
```

`ChartCard` is the box. It gives every chart a title and the "Show table" button.

- `columns` = the table's header row, like `["Day", "Orders"]`
- `rows` = one array per row, like `["Mon, Oct 5", "42"]`

## Step 4: Your first chart (a bar chart)

1. Open `src/pages/Dashboard.jsx`.
2. Find this line: `<div className="chart-grid">`
3. Right under it, paste:

```jsx
<ChartCard
  title="Sales by category"
  subtitle="Where the money came from"
  columns={["Category", "Sales"]}
  rows={view.categories.map((item) => [item.label, money(item.value)])}
>
  <BarChart
    label="Sales by category"
    items={view.categories}
    formatValue={(value) => money(value)}
  />
</ChartCard>
```

4. Save. Look at `localhost:5173/dashboard`. Your chart is there.

**What each prop means:**

- `label`: what a screen reader says out loud.
- `items`: the data, as `[{ label, value }, ...]`.
- `formatValue`: turns `1234` into text. `money(1234)` gives `$1,234`.

## Step 5: A line chart

Paste this the same way:

```jsx
<ChartCard
  title="Orders per day"
  subtitle="How many orders came in each day"
  columns={["Day", "Orders"]}
  rows={view.days.map((day) => [longDate(day.date), fullNumber(day.orders)])}
>
  <LineChart
    label="Orders per day"
    dates={view.days.map((day) => day.date)}
    series={[
      { key: "orders", name: "Orders", color: "var(--series-1)", values: view.days.map((day) => day.orders) },
    ]}
    formatValue={(value) => fullNumber(value)}
  />
</ChartCard>
```

**What's new here:**

- `dates`: the left-to-right axis. One date per day.
- `series`: the line. It's a list, because you can have more than one line.
  - `key`: any unique word.
  - `name`: shown in the tooltip.
  - `color`: always start with `var(--series-1)`.
  - `values`: one number per date.

**Want 2 lines?** Add a second `{ ... }` to `series` with `color: "var(--series-2)"`.
Only do this if both lines use the **same unit** (orders and orders, dollars and dollars).

## Step 6: The segmented bar (your "pie")

**First**, add this at the top of `Dashboard.jsx`, under the other `import` lines:

```jsx
import SegmentedBar from "../components/charts/SegmentedBar.jsx";
```

> Why? A file can only use components it **imports**. This line says "go get
> SegmentedBar from that file."

**Then** paste inside `<div className="chart-grid">`:

```jsx
<ChartCard
  className="chart-card--wide"
  title="Share of sales"
  subtitle="How the total splits by category"
  columns={["Category", "Sales"]}
  rows={view.categories.map((item) => [item.label, money(item.value)])}
>
  <SegmentedBar
    label="Share of sales by category"
    items={view.categories}
    formatValue={(value) => money(value)}
  />
</ChartCard>
```

`chart-card--wide` makes the card stretch across the full row.

## Step 7: A stat tile (one big number)

Find `<div className="stats">` and add:

```jsx
<StatTile
  label="Orders"
  value={fullNumber(view.totals.orders)}
  change={view.changes.orders}
  period="last week"
/>
```

- `change`: `0.12` means 12% more. The tile writes the sentence and picks the arrow.
- For numbers where **up is bad** (refunds, returns), add `goodWhenUp={false}`.

## Step 8: If something breaks

| What you see | What it usually means |
|---|---|
| Blank page | Open the browser console (Cmd+Option+J). The red error names the file and line. |
| `X is not defined` | You forgot the `import` line at the top (Step 6). |
| `Unexpected token` | A missing `}`, `)` or `>`. Check the last thing you pasted. |
| Chart shows but is empty | The data shape is wrong. Check that it's `[{ label, value }]`. |

**Part 2 done. You can now build any chart on the dashboard.**

---

# PART 3: Advanced (filters, tooltips, colors)

## A. How filters work

The dashboard has 2 filters: the **Business** dropdown and the **7 / 30 days** buttons.
Both are just `useState` (Idea 5). Here's the real code from `Dashboard.jsx`:

```jsx
// 1. Memory for each filter
const [business, setBusiness] = useState("coffee");
const [range, setRange] = useState(30);

// 2. Get the data for whatever is picked
const view = useMemo(() => businessView(business, range), [business, range]);
```

```jsx
// 3. The dropdown changes the memory
<select value={business} onChange={(event) => setBusiness(event.target.value)}>
  ...
</select>

// 4. The 7/30 buttons change the memory
<RangePicker value={range} options={[7, 30]} onChange={setRange} />
```

**The chain:** you pick a filter → `setBusiness` or `setRange` runs → React redraws →
`view` gets new data → **every chart updates at once.** You don't touch the charts.

> `useMemo` just means "only recalculate `view` when `business` or `range` changes."
> It's a speed trick. The page works the same without it.

**Add your own filter (example: a 90-day option):**
Change `options={[7, 30]}` to `options={[7, 30, 90]}`. Then make sure
`businessView()` in `sampleBusiness.js` can handle 90 days. That part is the data
side, your strength.

**Filter rules:**
- All filters go in **one row above the charts**, never inside a chart.
- Every filter changes **every chart** on the page.

## B. How tooltips work

Every tooltip in REV is built with the same 4 parts. Open `SegmentedBar.jsx` and
find each one.

**Part 1: Remember what's hovered** (it's `useState` again)
```jsx
const [active, setActive] = useState(null);   // null = nothing hovered
```

**Part 2: Update it for the mouse AND the keyboard**
```jsx
onPointerEnter={() => setActive(index)}   // mouse comes in
onPointerLeave={() => setActive(null)}    // mouse leaves
onFocus={() => setActive(index)}          // Tab key lands on it
onBlur={() => setActive(null)}            // Tab key leaves
tabIndex={0}                              // lets the Tab key reach it
```
Always do both. People on keyboards and phones need the same info.

**Part 3: Only show it for the hovered item**
```jsx
{active === index && (
  <span className="chart-tooltip">
    <strong>{formatValue(part.value)}</strong>   {/* the number: bold, first */}
    <span>{part.label}</span>                     {/* the name: smaller, second */}
  </span>
)}
```
`A && B` means "only show B if A is true." That's how it appears and disappears.

**Part 4: Place it with CSS** (in `styles/dashboard.css`)
```css
.chart-tooltip {
  position: absolute;      /* floats on top of the chart */
  pointer-events: none;    /* never blocks the mouse */
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
```
The thing it floats over needs `position: relative`.

**The line chart is special.** A 2px line is too thin to hover. So it finds the
**closest day** to your mouse, draws a vertical line there, and shows every line's
number for that day. The arrow keys move day by day. (See `pick()` in `LineChart.jsx`.)

**Tooltip design rules:**
1. **Number first and bold, name second.** The reader wants the number.
2. **Keep it short.** 1 to 3 lines.
3. **Never put a number ONLY in the tooltip.** It must also be in "Show table".
4. **Change the look in CSS, not JSX.** Edit `.chart-tooltip` once, and every tooltip changes.
5. **Don't cover the thing you're describing.** Put it above or beside.

**Practice:** add a line to the segmented bar tooltip that says "#2 of 5".
Hint: the rank is `index + 1` and the total is `parts.length`.

## C. Chart colors

The colors live in `styles/tokens.css`:

| Color | Use it for |
|---|---|
| `--series-1` (blue) | First line, first slice, every single-color bar chart |
| `--series-2` (orange) | Second line or slice |
| `--series-3` (aqua) | Third slice |
| `--series-4` (yellow) | Fourth slice |
| `--series-5` (magenta) | Fifth slice |

They're tested for colorblind readers in dark and light mode.

**Rules:**
1. **Always in order.** First thing = series-1, second = series-2. Never skip.
2. **No ruby or red for data.** Ruby is your brand (buttons). Red means "bad".
3. **Same thing, same color.** If Espresso is blue in one chart, it's blue everywhere.
4. **Text stays white or gray.** The colored mark next to it shows the series.
5. **Need more than 5 colors?** Use a bar chart instead, or group the small ones as "Other".

## D. Checklist before a chart is done

- [ ] The title says the question in plain words
- [ ] Right chart for the question (Part 2, Step 2)
- [ ] "Show table" works (`columns` and `rows` are filled in)
- [ ] The tooltip works with the mouse **and** the Tab key
- [ ] Looks good in dark **and** light mode (sun/moon button)
- [ ] Looks good on a phone (make the browser window narrow)
- [ ] No ruby or red used for data

---

## Later: real client data

Right now `businessView()` makes fake numbers. For a real client, you replace only
that function with their real numbers (Shopify, Square, a spreadsheet), in the same
shape. **The charts don't change at all.** That's why the data and the charts are
kept separate.
