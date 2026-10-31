// The game library. Anyone can browse; only the admin sees Add/Edit/Delete.
// Platform and genre filters are built from the games that loaded, the same
// way my Xenoblade events filter and CIS485 product filter build theirs.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import GameCard from "../components/GameCard.jsx";
import DeleteButton from "../components/DeleteButton.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import gamesApi, { GAMES_PER_PAGE } from "../services/gamesApi.js";
import usePageTitle from "../hooks/usePageTitle.js";

const SORTS = {
  title: { label: "Title A to Z", compare: (a, b) => a.title.localeCompare(b.title) },
  newest: { label: "Newest release", compare: (a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0) },
  playtime: { label: "Most played", compare: (a, b) => (b.playtimeHours ?? 0) - (a.playtimeHours ?? 0) },
};

// Unique, sorted values for a filter dropdown (a Set skips repeats).
const optionsFor = (games, key) => [...new Set(games.map((game) => game[key]).filter(Boolean))].sort();

export default function Games() {
  usePageTitle("Games");
  const { isAdmin } = useAuth();
  const [games, setGames] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [genre, setGenre] = useState("all");
  const [sort, setSort] = useState("title");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");
    gamesApi
      .list(page)
      .then((batch) => {
        if (ignore) return;
        setGames((previous) => (page === 1 ? batch : [...previous, ...batch]));
        setHasMore(batch.length === GAMES_PER_PAGE);
      })
      .catch((problem) => {
        if (!ignore) setError(problem.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [page, attempt]);

  const platforms = useMemo(() => optionsFor(games, "platform"), [games]);
  const genres = useMemo(() => optionsFor(games, "genre"), [games]);

  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    return games
      .filter((game) => platform === "all" || game.platform === platform)
      .filter((game) => genre === "all" || game.genre === genre)
      .filter((game) => !text || game.title.toLowerCase().includes(text))
      .sort(SORTS[sort].compare);
  }, [games, search, platform, genre, sort]);

  async function deleteGame(game) {
    await gamesApi.remove(game._id);
    setGames((previous) => previous.filter((item) => item._id !== game._id));
  }

  return (
    <div className="page">
      <header className="page-head page-head--split">
        <div>
          <h1>The game library</h1>
          <p>Every game in the vault, with the hours I've put in. Open one to read the community's reviews.</p>
        </div>
        {isAdmin && (
          <Link className="button button--primary" to="/admin/games/new">Add a game</Link>
        )}
      </header>

      <div className="toolbar" role="search">
        <div className="field field--grow">
          <label htmlFor="game-search">Search by title</label>
          <input id="game-search" className="input" type="search" value={search} placeholder="Try Xenoblade" onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="game-platform">Platform</label>
          <select id="game-platform" className="select" value={platform} onChange={(event) => setPlatform(event.target.value)}>
            <option value="all">All platforms</option>
            {platforms.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="game-genre">Genre</label>
          <select id="game-genre" className="select" value={genre} onChange={(event) => setGenre(event.target.value)}>
            <option value="all">All genres</option>
            {genres.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="game-sort">Sort by</label>
          <select id="game-sort" className="select" value={sort} onChange={(event) => setSort(event.target.value)}>
            {Object.entries(SORTS).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
          </select>
        </div>
      </div>

      {games.length > 0 && (
        <p className="results-note" role="status">
          Showing {visible.length} of {games.length} games.
        </p>
      )}

      {error && (
        <StatusMessage kind="error" title="The library didn't load." action={<button type="button" className="button" onClick={() => setAttempt((count) => count + 1)}>Try again</button>}>
          {error}
        </StatusMessage>
      )}

      {!error && loading && games.length === 0 && <StatusMessage kind="loading" title="Loading games" />}

      {!error && !loading && games.length === 0 && (
        <StatusMessage
          kind="empty"
          title="The library is empty right now."
          action={isAdmin ? <Link className="button button--primary" to="/admin/games/new">Add the first game</Link> : null}
        >
          {isAdmin ? "Add a game and it shows up here for everyone." : "Games will show up here soon."}
        </StatusMessage>
      )}

      {games.length > 0 && visible.length === 0 && (
        <StatusMessage kind="empty" title="No games match those filters.">
          Clear the search or pick All platforms and All genres.
        </StatusMessage>
      )}

      {visible.length > 0 && <h2 className="visually-hidden">Games</h2>}
      {visible.length > 0 && (
        <div className="game-grid">
          {visible.map((game) => (
            <GameCard
              key={game._id}
              game={game}
              adminActions={
                isAdmin ? (
                  <>
                    <Link className="button button--small" to={`/admin/games/${game._id}/edit`}>Edit</Link>
                    <DeleteButton small itemName={game.title} onDelete={() => deleteGame(game)} />
                  </>
                ) : null
              }
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="load-more">
          <button type="button" className="button" disabled={loading} onClick={() => setPage((current) => current + 1)}>
            {loading ? "Loading..." : "Load more games"}
          </button>
        </div>
      )}
    </div>
  );
}
