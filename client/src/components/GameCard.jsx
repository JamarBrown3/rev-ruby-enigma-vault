// One game in the library grid (also the live preview in the admin editor).
// Card layout: my video_gameStore game card + my Xenoblade event card.
import { useState } from "react";
import { Link } from "react-router-dom";
import { cssImageUrl, excerpt } from "../utils/format.js";

export default function GameCard({ game, adminActions = null, preview = false }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = game.coverImage && !imageFailed;
  const detailsPath = game._id ? `/games/${game._id}` : null;

  const facts = [game.genre, game.releaseYear].filter(Boolean).join(", ");
  const title = game.title || "Untitled game";

  const cover = (
    <span className="game-card__cover" style={{ "--cover": showImage ? cssImageUrl(game.coverImage) : undefined }}>
      {showImage ? (
        <img src={game.coverImage} alt={`${title} cover`} loading="lazy" onError={() => setImageFailed(true)} />
      ) : (
        <span className="game-card__fallback" aria-hidden="true">{title.charAt(0)}</span>
      )}
    </span>
  );

  return (
    <article className="game-card">
      {detailsPath && !preview ? (
        <Link to={detailsPath} tabIndex={-1} aria-hidden="true">
          {cover}
        </Link>
      ) : (
        cover
      )}

      <div className="game-card__body">
        {game.platform && <p className="game-card__platform">{game.platform}</p>}
        <h3 className="game-card__title">
          {detailsPath && !preview ? <Link to={detailsPath}>{title}</Link> : title}
        </h3>
        {facts && <p className="game-card__meta">{facts}</p>}
        {game.description && <p className="game-card__description">{excerpt(game.description, 140)}</p>}

        <footer className="game-card__footer">
          <span>
            {typeof game.playtimeHours === "number" && game.playtimeHours > 0
              ? `${game.playtimeHours} hours played`
              : "Not played yet"}
          </span>
          {adminActions && <div className="game-card__admin">{adminActions}</div>}
        </footer>
      </div>
    </article>
  );
}
