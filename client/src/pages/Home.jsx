// Home: the slider, then the community archive (posts from the API).
// Search and sort work on the posts already loaded; "Load more" fetches the
// next 20. (Moving search to the server is a later step.)
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import VaultSlider from "../components/VaultSlider.jsx";
import PostCard from "../components/PostCard.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import postsApi, { POSTS_PER_PAGE } from "../services/postsApi.js";
import { SLIDES } from "../data/slides.js";
import { authorName } from "../utils/format.js";
import usePageTitle from "../hooks/usePageTitle.js";

const SORTS = {
  newest: { label: "Newest first", compare: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  oldest: { label: "Oldest first", compare: (a, b) => new Date(a.createdAt) - new Date(b.createdAt) },
  rating: { label: "Highest rated reviews", compare: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) },
  title: { label: "Title A to Z", compare: (a, b) => a.title.localeCompare(b.title) },
};

export default function Home() {
  usePageTitle("");
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState("newest");
  const [attempt, setAttempt] = useState(0); // bumps when "Try again" is pressed

  // Load a page of posts. Page 1 replaces the list; later pages add to it.
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");
    postsApi
      .list({ page })
      .then((batch) => {
        if (ignore) return;
        setPosts((previous) => (page === 1 ? batch : [...previous, ...batch]));
        setHasMore(batch.length === POSTS_PER_PAGE);
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

  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    return posts
      .filter((post) => kind === "all" || post.kind === kind)
      .filter((post) => {
        if (!text) return true;
        const gameTitle = post.gameId?.title ?? "";
        return [post.title, post.body, authorName(post), gameTitle].some((value) =>
          value.toLowerCase().includes(text),
        );
      })
      .sort(SORTS[sort].compare);
  }, [posts, search, kind, sort]);

  const writeLink = user ? (
    <Link className="button button--primary" to="/posts/new">Write a post</Link>
  ) : (
    <Link className="button" to="/login" state={{ from: "/posts/new" }}>Log in to post</Link>
  );

  return (
    <div className="page">
      <h1 className="visually-hidden">REV community posts</h1>
      <VaultSlider slides={SLIDES} />

      <section className="section" id="archive" aria-labelledby="archive-title">
        <div className="section-head">
          <div>
            <h2 id="archive-title">Latest from the vault</h2>
            <p>Reviews and discussions from the community. Anyone can read them; members can write their own.</p>
          </div>
          {writeLink}
        </div>

        <div className="toolbar" role="search">
          <div className="field field--grow">
            <label htmlFor="post-search">Search posts</label>
            <input
              id="post-search"
              className="input"
              type="search"
              placeholder="Title, game or author"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="post-kind">Show</label>
            <select id="post-kind" className="select" value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="all">Everything</option>
              <option value="review">Reviews</option>
              <option value="discussion">Discussions</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="post-sort">Sort by</label>
            <select id="post-sort" className="select" value={sort} onChange={(event) => setSort(event.target.value)}>
              {Object.entries(SORTS).map(([value, option]) => (
                <option key={value} value={value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        {posts.length > 0 && (
          <p className="results-note" role="status">
            Showing {visible.length} of {posts.length} loaded posts.
          </p>
        )}

        {error && (
          <StatusMessage
            kind="error"
            title="The posts didn't load."
            action={<button type="button" className="button" onClick={() => setAttempt((count) => count + 1)}>Try again</button>}
          >
            {error}
          </StatusMessage>
        )}

        {!error && loading && posts.length === 0 && <StatusMessage kind="loading" title="Loading posts" />}

        {!error && !loading && posts.length === 0 && (
          <StatusMessage kind="empty" title="No posts yet." action={writeLink}>
            Start the first discussion or review a game from the library.
          </StatusMessage>
        )}

        {posts.length > 0 && visible.length === 0 && (
          <StatusMessage kind="empty" title="Nothing matches that search.">
            Try a different word, or switch Show back to Everything.
          </StatusMessage>
        )}

        {visible.length > 0 && (
          <div className="post-grid">
            {visible.map((post) => (
              <PostCard key={post._id} post={post} />
            ))}
          </div>
        )}

        {hasMore && (
          <div className="load-more">
            <button type="button" className="button" disabled={loading} onClick={() => setPage((current) => current + 1)}>
              {loading ? "Loading..." : "Load more posts"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
