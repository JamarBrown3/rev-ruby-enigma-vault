// Member dashboard (/dashboard): the demo of what REV builds for clients.
// Pick a pretend business and a date range; every number, chart and the
// three-sentence summary update together. All data is sample data from
// src/data/sampleBusiness.js, so the page costs nothing per click.
import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import ChartCard from "../components/charts/ChartCard.jsx";
import LineChart from "../components/charts/LineChart.jsx";
import BarChart from "../components/charts/BarChart.jsx";
import StatTile from "../components/charts/StatTile.jsx";
import RangePicker from "../components/charts/RangePicker.jsx";
import { PrintIcon } from "../components/Icons.jsx";
import { BUSINESSES, businessView } from "../data/sampleBusiness.js";
import { fullNumber, longDate, money } from "../components/charts/scale.js";
import usePageTitle from "../hooks/usePageTitle.js";

const dayRange = (days) =>
  `${days[0].date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${days[days.length - 1].date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

export default function Dashboard() {
  usePageTitle("Sample dashboard");
  const { user } = useAuth();
  const [business, setBusiness] = useState("coffee");
  const [range, setRange] = useState(30);
  const view = useMemo(() => businessView(business, range), [business, range]);
  const before = range === 7 ? "the week before" : "the 30 days before";

  return (
    <div className="page dashboard">
      <header className="page-head page-head--split">
        <div>
          <h1>Sample dashboard</h1>
          <p>
            What a client dashboard looks like: the numbers, the trend, and three plain-English sentences about what
            happened. Everything here is made-up data for pretend businesses.
          </p>
        </div>
        <button type="button" className="button no-print" onClick={() => window.print()}>
          <PrintIcon /> Print or save as PDF
        </button>
      </header>

      <div className="filters">
        <div className="field">
          <label htmlFor="business">Business</label>
          <select id="business" className="select" value={business} onChange={(event) => setBusiness(event.target.value)}>
            {Object.entries(BUSINESSES).map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}
          </select>
        </div>
        <RangePicker value={range} options={[7, 30]} onChange={setRange} />
        <p className="filters__period">{view.name}, {dayRange(view.days)}</p>
      </div>

      <section className="summary" aria-labelledby="summary-title">
        <h2 id="summary-title" className="summary__title">What happened</h2>
        <ul className="summary__list">
          {view.summary.map((sentence) => <li key={sentence}>{sentence}</li>)}
        </ul>
        <p className="summary__note">
          Written by AI (Claude) from this sample data and saved, so the demo is free to click around. On a client's
          site, the server writes a new one each day from their real numbers.
        </p>
      </section>

      <div className="stats">
        <StatTile label="Sales" value={money(view.totals.revenue)} change={view.changes.revenue} period={before} />
        <StatTile label="Orders" value={fullNumber(view.totals.orders)} change={view.changes.orders} period={before} />
        <StatTile label="Average order" value={money(view.totals.averageOrder, { cents: true })} change={view.changes.averageOrder} period={before} />
        <StatTile label="Returning customers" value={`${Math.round(view.totals.returning * 100)}%`} change={view.changes.returning} period={before} />
      </div>

      <div className="chart-grid">
        <ChartCard
          className="chart-card--wide"
          title="Daily sales"
          subtitle={`Each day's sales, ${dayRange(view.days)}`}
          columns={["Day", "Sales", "Orders"]}
          rows={view.days.map((day) => [longDate(day.date), money(day.revenue), fullNumber(day.orders)])}
        >
          <LineChart
            label={`Daily sales for ${view.name}`}
            dates={view.days.map((day) => day.date)}
            series={[{ key: "sales", name: "Sales", color: "var(--series-1)", values: view.days.map((day) => day.revenue) }]}
            formatValue={(value) => money(value)}
            formatTick={(value) => money(value, { compact: true })}
          />
        </ChartCard>

        <ChartCard
          title="Sales by category"
          subtitle="Where the money came from"
          columns={["Category", "Sales"]}
          rows={view.categories.map((item) => [item.label, money(item.value)])}
        >
          <BarChart label={`Sales by category for ${view.name}`} items={view.categories} formatValue={(value) => money(value)} />
        </ChartCard>

        <ChartCard
          title={range === 7 ? "Sales by day of the week" : "Average day of the week"}
          subtitle={range === 7 ? "Each day this week" : "Average sales for each weekday"}
          columns={["Day", "Sales"]}
          rows={view.weekdays.map((item) => [item.label, money(item.value)])}
        >
          <BarChart label={`Sales by day of the week for ${view.name}`} items={view.weekdays} formatValue={(value) => money(value)} showShare={false} />
        </ChartCard>
      </div>

      <p className="print-only print-footer">Printed from REV by {user?.username}. Sample data only.</p>
    </div>
  );
}
