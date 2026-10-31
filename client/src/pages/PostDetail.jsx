// One post. Its author sees Edit and Delete (the server checks ownership again).
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import DeleteButton from "../components/DeleteButton.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import Rating from "../components/Rating.jsx";
import postsApi from "../services/postsApi.js";
import { authorName, formatDate } from "../utils/format.js";
import usePageTitle from "../hooks/usePageTitle.js";
import NotFound from "./NotFound.jsx";

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  usePageTitle(post?.title ?? "Post");

  useEffect(() => {
    let ignore = false;
    setStatus("loading");
    postsApi
      .get(id)
      .then((found) => {
        if (ignore) return;
        setPost(found);
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
  if (status === "loading") return <div className="page page--narrow"><StatusMessage kind="loading" title="Loading post" /></div>;
  if (status === "error") {
    return (
      <div className="page page--narrow">
        <StatusMessage kind="error" title="This post didn't load." action={<Link className="button" to="/">Back to posts</Link>}>
          {error}
        </StatusMessage>
      </div>
    );
  }

  const isReview = post.kind === "review";
  const game = post.gameId && typeof post.gameId === "object" ? post.gameId : null;
  const isAuthor = Boolean(user && post.authorId && post.authorId._id === user.id);
  const edited = new Date(post.updatedAt) - new Date(post.createdAt) > 60_000;

  return (
    <div className="page page--narrow">
      <Link className="back-link" to="/#archive">Back to posts</Link>

      <article className="post-detail">
        <header className="post-detail__head">
          <p className="post-detail__kind">
            {isReview && game ? (
              <>Review of <Link to={`/games/${game._id}`}>{game.title}</Link></>
            ) : (
              "Discussion"
            )}
          </p>
          <h1 className="post-detail__title">{post.title}</h1>
          <p className="post-detail__meta">
            By <strong>{authorName(post)}</strong> on <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
            {edited && <span> (edited {formatDate(post.updatedAt)})</span>}
          </p>
          {isReview && (
            <div className="post-detail__rating">
              {game?.coverImage && <img src={game.coverImage} alt="" className="post-card__thumb" />}
              <Rating value={post.rating} recommend={post.recommend} />
            </div>
          )}
        </header>

        <div className="post-detail__body">{post.body}</div>

        {isAuthor && (
          <div className="form-actions">
            <Link className="button" to={`/posts/${post._id}/edit`}>Edit post</Link>
            <DeleteButton
              itemName={post.title}
              label="Delete post"
              onDelete={async () => {
                await postsApi.remove(post._id);
                navigate("/");
              }}
            />
          </div>
        )}
      </article>

      <section className="section post-detail__later" aria-labelledby="comments-title">
        <h2 id="comments-title" className="post-detail__later-title">Comments and likes</h2>
        <p>Comments and the like/dislike buttons are on the way. They'll show up here once those routes are built.</p>
      </section>
    </div>
  );
}
