// Admin dashboard (/admin/dashboard): Jah only. The server also guards
// /api/admin and /api/dashboard with requireAdmin (password + 6-digit code).
// Charts and totals are SAMPLE numbers until the admin stats route exists;
// the "Newest posts" table is live from the API.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import ChartCard from "../components/charts/ChartCard.jsx";
import LineChart from "../components/charts/LineChart.jsx";
import BarChart from "../components/charts/BarChart.jsx";
import StatTile from "../components/charts/StatTile.jsx";
import RangePicker from "../components/charts/RangePicker.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import { PrintIcon } from "../components/Icons.jsx";
import { communityView, GAMES_IN_LIBRARY, TOP_RATED } from "../data/sampleCommunity.js";
import { fullNumber, longDate, shortDate } from "../components/charts/scale.js";
import postsApi from "../services/postsApi.js";
import { authorName, formatDate } from "../utils/format.js";
import usePageTitle from "../hooks/usePageTitle.js";

const PERIOD_NAMES = { 7: "the week before", 30: "the 30 days before", 90: "the 90 days before" };
const SUMMARY_TITLES = { 7: "This week in the vault", 30: "This month in the vault", 90: "The last three months" };

export default function AdminDashboard() {
  usePageTitle("Admin dashboard");
  const { user } = useAuth();
  const [range, setRange] = useState(30);
  const view = useMemo(() => communityView(range), [range]);
  const [posts, setPosts] = useState(null);
  const [postsError, setPostsError] = useState("");

  useEffect(() => {
    let ignore = false;
    postsApi
      .list({ page: 1 })
      .then((list) => {
        if (!ignore) setPosts(list.slice(0, 8));
      })
      .catch((problem) => {
        if (!ignore) setPostsError(problem.message);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const before = PERIOD_NAMES[range];
  const dates = view.days.map((day) => day.date);

  return (
    <div className="page dashboard">
      <header className="page-head page-head--split">
        <div>
          <h1>Dashboard</h1>
          <p>
            Signed in as {user?.username}. The summary, totals and charts use sample numbers until the admin stats
            route is built. The newest posts table is live.
          </p>
        </div>
        <button type="button" className="button no-print" onClick={() => window.print()}>
          <PrintIcon /> Download report
        </button>
      </header>

      <div className="filters">
        <RangePicker value={range} options={[7, 30, 90]} onChange={setRange} />
        <p className="filters__period">
          <span className="pill">Sample numbers</span> {shortDate(dates[0])} to {shortDate(dates[dates.length - 1])}, {dates[dates.length - 1].getFullYear()}
        </p>
      </div>

      <section className="summary" aria-labelledby="admin-summary-title">
        <h2 id="admin-summary-title" className="summary__title">{SUMMARY_TITLES[range]}</h2>
        <ul className="summary__list">
          {view.summary.map((sentence) => <li key={sentence}>{sentence}</li>)}
        </ul>
        <p className="summary__note">Written by AI (Claude) from the sample numbers. Later the server writes this from the real database.</p>
      </section>

      <div className="stats">
        <StatTile label="New posts" value={fullNumber(view.totals.posts)} change={view.changes.posts} period={before} />
        <StatTile label="New reviews" value={fullNumber(view.totals.reviews)} change={view.changes.reviews} period={before} />
        <StatTile label="New members" value={fullNumber(view.totals.members)} change={view.changes.members} period={before} />
        <StatTile label="Games in library" value={fullNumber(GAMES_IN_LIBRARY.total)} note={`${GAMES_IN_LIBRARY.added[range]} added in the last ${range} days`} />
      </div>

      <div className="chart-grid">
        <ChartCard
          className="chart-card--wide"
          title="New posts per day"
          subtitle="Discussions and reviews, counted separately"
          columns={["Day", "Discussions", "Reviews"]}
          rows={view.days.map((day) => [longDate(day.date), day.discussions, day.reviews])}
        >
          <LineChart
            label="New posts per day"
            dates={dates}
            series={[
              { key: "discussions", name: "Discussions", color: "var(--series-1)", values: view.days.map((day) => day.discussions) },
              { key: "reviews", name: "Reviews", color: "var(--series-2)", values: view.days.map((day) => day.reviews) },
            ]}
            formatValue={(value) => fullNumber(value)}
          />
        </ChartCard>

        <ChartCard title="Reviews by platform" subtitle={`Last ${range} days`} columns={["Platform", "Reviews"]} rows={view.platforms.map((item) => [item.label, item.value])}>
          <BarChart label="Reviews by platform" items={view.platforms} formatValue={(value) => fullNumber(value)} />
        </ChartCard>

        <section className="chart-card">
          <header className="chart-card__head">
            <div>
              <h3 className="chart-card__title">Top rated games</h3>
              <p className="chart-card__subtitle">Sample titles until real reviews add up</p>
            </div>
          </header>
          <div className="table-wrap">
            <table className="data-table">
              <caption className="visually-hidden">Top rated games (sample)</caption>
              <thead>
                <tr><th scope="col">Game</th><th scope="col">Average</th><th scope="col">Reviews</th></tr>
              </thead>
              <tbody>
                {TOP_RATED.map((game) => (
                  <tr key={game.title}><th scope="row">{game.title}</th><td>{game.rating.toFixed(1)}</td><td>{game.reviews}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="section" id="live-posts" aria-labelledby="live-posts-title">
        <div className="section-head">
          <div>
            <h2 id="live-posts-title">Newest posts</h2>
            <p>Live from the database. Deleting any member's post comes with the admin routes.</p>
          </div>
        </div>
        {postsError && <StatusMessage kind="error" title="Newest posts didn't load.">{postsError}</StatusMessage>}
        {!postsError && posts === null && <StatusMessage kind="loading" title="Loading posts" />}
        {posts && posts.length === 0 && <StatusMessage kind="empty" title="No posts yet." />}
        {posts && posts.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="visually-hidden">Newest posts</caption>
              <thead>
                <tr><th scope="col">Title</th><th scope="col">Type</th><th scope="col">Author</th><th scope="col">Posted</th></tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post._id}>
                    <th scope="row"><Link to={`/posts/${post._id}`}>{post.title}</Link></th>
                    <td>{post.kind === "review" ? `Review of ${post.gameId?.title ?? "a game"}` : "Discussion"}</td>
                    <td>{authorName(post)}</td>
                    <td>{formatDate(post.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section no-print" aria-labelledby="tools-title">
        <h2 id="tools-title">Admin tools</h2>
        <div className="tools">
          <Link className="tool" to="/admin/games/new">
            <span className="tool__name">Add a game</span>
            <span className="tool__text">Put a new game in the public library.</span>
          </Link>
          <Link className="tool" to="/games">
            <span className="tool__name">Manage the library</span>
            <span className="tool__text">Edit or delete games from their cards.</span>
          </Link>
          {import.meta.env.DEV && (
            <Link className="tool" to="/dev/routes">
              <span className="tool__name">Route tester</span>
              <span className="tool__text">Click through every API route (only while developing).</span>
            </Link>
          )}
        </div>
      </section>

      <p className="print-only print-footer">Report printed from REV. Totals and charts are sample numbers.</p>
    </div>
  );
}
