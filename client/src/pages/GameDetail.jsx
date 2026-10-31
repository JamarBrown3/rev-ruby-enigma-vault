// One game: its details and the community's reviews of it.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import PostCard from "../components/PostCard.jsx";
import DeleteButton from "../components/DeleteButton.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import Rating from "../components/Rating.jsx";
import gamesApi from "../services/gamesApi.js";
import postsApi from "../services/postsApi.js";
import { cssImageUrl, plural } from "../utils/format.js";
import usePageTitle from "../hooks/usePageTitle.js";
import NotFound from "./NotFound.jsx";

export default function GameDetail() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | missing | error
  const [error, setError] = useState("");
  usePageTitle(game?.title ?? "Game");

  useEffect(() => {
    let ignore = false;
    setStatus("loading");
    Promise.all([gamesApi.get(id), postsApi.list({ gameId: id })])
      .then(([foundGame, gamePosts]) => {
        if (ignore) return;
        setGame(foundGame);
        setReviews(gamePosts.filter((post) => post.kind === "review"));
        setStatus("ready");
      })
      .catch((problem) => {
        if (ignore) return;
        setError(problem.message);
        setStatus(problem.status === 404 ? "missing" : "error");
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  if (status === "missing") return <NotFound />;
  if (status === "loading") return <div className="page"><StatusMessage kind="loading" title="Loading game" /></div>;
  if (status === "error") {
    return (
      <div className="page">
        <StatusMessage kind="error" title="This game didn't load." action={<Link className="button" to="/games">Back to the library</Link>}>
          {error}
        </StatusMessage>
      </div>
    );
  }

  const ratings = reviews.map((review) => review.rating).filter((value) => typeof value === "number");
  const average = ratings.length ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10 : null;
  const banner = cssImageUrl(game.headerImage || game.coverImage);

  return (
    <div className="page">
      <Link className="back-link" to="/games">Back to the library</Link>

      <article className="game-detail">
        <div
          className={`game-detail__banner${game.headerImage ? "" : " game-detail__banner--from-cover"}`}
          style={{ "--banner": banner }}
          aria-hidden="true"
        />
        <div className="game-detail__main">
          {game.coverImage && <img className="game-detail__cover" src={game.coverImage} alt={`${game.title} cover`} />}
          <div className="game-detail__info">
            {game.platform && <p className="game-card__platform">{game.platform}</p>}
            <h1 className="game-detail__title">{game.title}</h1>
            <dl className="facts">
              {game.genre && (<div><dt>Genre</dt><dd>{game.genre}</dd></div>)}
              {game.releaseYear && (<div><dt>Released</dt><dd>{game.releaseYear}</dd></div>)}
              <div><dt>My playtime</dt><dd>{game.playtimeHours ? `${game.playtimeHours} hours` : "Not played yet"}</dd></div>
              <div>
                <dt>Community rating</dt>
                <dd>{average !== null ? <><Rating value={average} /> <span className="facts__note">from {plural(ratings.length, "review")}</span></> : "No reviews yet"}</dd>
              </div>
            </dl>
            {isAdmin && (
              <div className="form-actions">
                <Link className="button" to={`/admin/games/${game._id}/edit`}>Edit game</Link>
                <DeleteButton
                  itemName={game.title}
                  label="Delete game"
                  onDelete={async () => {
                    await gamesApi.remove(game._id);
                    navigate("/games");
                  }}
                />
              </div>
            )}
          </div>
        </div>
        {game.description && <p className="game-detail__description">{game.description}</p>}
      </article>

      <section className="section" aria-labelledby="reviews-title">
        <div className="section-head">
          <div>
            <h2 id="reviews-title">Reviews</h2>
            <p>{reviews.length ? `${plural(reviews.length, "review")} from the community, newest first.` : "Nobody has reviewed this game yet."}</p>
          </div>
          {user ? (
            <Link className="button button--primary" to={`/posts/new?gameId=${game._id}`}>Write a review</Link>
          ) : (
            <Link className="button" to="/login" state={{ from: `/posts/new?gameId=${game._id}` }}>Log in to review</Link>
          )}
        </div>
        {reviews.length > 0 && (
          <div className="post-grid">
            {reviews.map((post) => <PostCard key={post._id} post={post} />)}
          </div>
        )}
      </section>
    </div>
  );
}
