// One community post in the grid. Posts are text only (decided: no member
// images or links), so a review shows its game's cover and a discussion shows
// a plain marker instead.
import { Link } from "react-router-dom";
import Rating from "./Rating.jsx";
import { ChatIcon, GemIcon } from "./Icons.jsx";
import { authorName, excerpt, formatDate } from "../utils/format.js";

export default function PostCard({ post }) {
  const isReview = post.kind === "review";
  const game = post.gameId && typeof post.gameId === "object" ? post.gameId : null;

  return (
    <article className="post-card">
      <p className="post-card__kind">
        {isReview && game?.coverImage ? (
          <img className="post-card__thumb" src={game.coverImage} alt="" loading="lazy" />
        ) : (
          <span className="post-card__badge" aria-hidden="true">{isReview ? <GemIcon /> : <ChatIcon />}</span>
        )}
        <span>{isReview ? `Review of ${game?.title ?? "a game"}` : "Discussion"}</span>
      </p>

      <h3 className="post-card__title">
        <Link to={`/posts/${post._id}`}>{post.title}</Link>
      </h3>

      <p className="post-card__excerpt">{excerpt(post.body)}</p>

      {isReview && <Rating value={post.rating} recommend={post.recommend} />}

      <footer className="post-card__footer">
        <span>
          By <strong>{authorName(post)}</strong>
        </span>
        <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
      </footer>
    </article>
  );
}
