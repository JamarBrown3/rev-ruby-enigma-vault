// Write a post (/posts/new) or edit your own (/posts/:id/edit).
// The checks here match server/controllers/posts.js so most mistakes are
// caught before sending; the server still checks everything again.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import postsApi from "../services/postsApi.js";
import gamesApi from "../services/gamesApi.js";
import { messageFor } from "../services/request.js";
import usePageTitle from "../hooks/usePageTitle.js";

const LIMITS = { title: 400, body: 10000 };

// A new post's text is kept in this tab (sessionStorage) while you type, so
// it survives a refresh or having to log in again. It's cleared once published.
const DRAFT_KEY = "rev-post-draft";

function loadDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY)) ?? null;
  } catch {
    return null;
  }
}

function saveDraft(form) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ kind: form.kind, title: form.title, body: form.body }));
  } catch {
    // Storage blocked: typing still works, there's just no backup.
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}

function checkPost(form, editing) {
  const problems = {};
  if (!form.title.trim()) problems.title = "Give your post a title.";
  else if (form.title.length > LIMITS.title) problems.title = `Keep the title under ${LIMITS.title} characters.`;
  if (!form.body.trim()) problems.body = "Write something in the post.";
  else if (form.body.length > LIMITS.body) problems.body = `Keep the post under ${LIMITS.body.toLocaleString()} characters.`;
  if (form.kind === "review") {
    if (!editing && !form.gameId) problems.gameId = "Pick the game you're reviewing.";
    const rating = Number(form.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) problems.rating = "Pick a rating from 1 to 10.";
  }
  return problems;
}

export default function PostEditor() {
  const { id } = useParams();
  const editing = Boolean(id);
  usePageTitle(editing ? "Edit post" : "Write a post");
  const [searchParams] = useSearchParams();
  const presetGame = searchParams.get("gameId") ?? "";
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(() => {
    const draft = editing ? null : loadDraft();
    return {
      kind: presetGame ? "review" : draft?.kind ?? "discussion",
      title: draft?.title ?? "",
      body: draft?.body ?? "",
      gameId: presetGame,
      rating: "",
      recommend: "", // "yes" | "no" | "" (not saying)
    };
  });
  const [games, setGames] = useState([]);
  const [problems, setProblems] = useState({});
  const [formError, setFormError] = useState("");
  const [status, setStatus] = useState(editing ? "loading" : "ready");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  // Editing: load the post, and only let its author continue.
  useEffect(() => {
    if (!editing) return undefined;
    let ignore = false;
    postsApi
      .get(id)
      .then((post) => {
        if (ignore) return;
        if (!user || post.authorId?._id !== user.id) {
          setStatus("not-yours");
          return;
        }
        setForm({
          kind: post.kind,
          title: post.title,
          body: post.body,
          gameId: post.gameId?._id ?? "",
          gameTitle: post.gameId?.title ?? "",
          rating: post.rating ? String(post.rating) : "",
          recommend: post.recommend === true ? "yes" : post.recommend === false ? "no" : "",
        });
        setStatus("ready");
      })
      .catch((problem) => {
        if (ignore) return;
        setFormError(problem.message);
        setStatus("error");
      });
    return () => {
      ignore = true;
    };
  }, [editing, id, user]);

  // Back up a new post's text while typing.
  useEffect(() => {
    if (!editing && (form.title || form.body)) saveDraft(form);
  }, [editing, form]);

  // New reviews need the list of games to pick from (first 24 for now).
  useEffect(() => {
    if (editing) return undefined;
    let ignore = false;
    gamesApi
      .list(1)
      .then((list) => {
        if (!ignore) setGames(list);
      })
      .catch(() => {
        if (!ignore) setGames([]);
      });
    return () => {
      ignore = true;
    };
  }, [editing]);

  function update(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setProblems((previous) => ({ ...previous, [name]: undefined }));
  }

  // Only send fields the server accepts for this kind of post.
  function buildBody() {
    const body = { title: form.title.trim(), body: form.body.trim() };
    if (!editing) body.kind = form.kind;
    if (form.kind === "review") {
      if (!editing) body.gameId = form.gameId;
      body.rating = Number(form.rating);
      if (form.recommend) body.recommend = form.recommend === "yes";
    }
    return body;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const found = checkPost(form, editing);
    setProblems(found);
    if (Object.keys(found).length) return;

    submitting.current = true;
    setSaving(true);
    setFormError("");
    try {
      const saved = editing ? await postsApi.update(id, buildBody()) : await postsApi.create(buildBody());
      if (!editing) clearDraft();
      navigate(`/posts/${saved._id}`);
    } catch (problem) {
      setFormError(
        messageFor(problem, {
          401: "Your session ended. Log in again; your text is saved in this tab.",
          404: editing ? "This post no longer exists, or it isn't yours." : "That game is no longer in the library.",
        }),
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  if (status === "loading") return <div className="page page--narrow"><StatusMessage kind="loading" title="Loading your post" /></div>;
  if (status === "not-yours") {
    return (
      <div className="page page--narrow">
        <StatusMessage kind="error" title="You can only edit your own posts." action={<Link className="button" to={`/posts/${id}`}>View the post</Link>} />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="page page--narrow">
        <StatusMessage kind="error" title="This post didn't load." action={<Link className="button" to="/">Back to posts</Link>}>{formError}</StatusMessage>
      </div>
    );
  }

  const isReview = form.kind === "review";
  const describedBy = (name) => (problems[name] ? `${name}-error` : undefined);

  return (
    <div className="page page--narrow">
      <Link className="back-link" to={editing ? `/posts/${id}` : "/"}>{editing ? "Back to the post" : "Back to posts"}</Link>
      <header className="page-head">
        <h1>{editing ? "Edit your post" : "Write a post"}</h1>
        <p>Posts are text only. Be kind, stay on topic, and keep spoilers out of titles.</p>
      </header>

      <form className="panel" onSubmit={handleSubmit} noValidate>
        <fieldset disabled={saving}>
          {!editing && (
            <fieldset className="field">
              <legend>What are you posting?</legend>
              <div className="choice-row">
                <label className="choice">
                  <input type="radio" name="kind" value="discussion" checked={form.kind === "discussion"} onChange={update} />
                  A discussion
                </label>
                <label className="choice">
                  <input type="radio" name="kind" value="review" checked={form.kind === "review"} onChange={update} />
                  A review of a game
                </label>
              </div>
            </fieldset>
          )}

          {isReview && !editing && (
            <div className="field">
              <label htmlFor="gameId">Game</label>
              <select id="gameId" name="gameId" className="select" value={form.gameId} onChange={update} aria-invalid={Boolean(problems.gameId)} aria-describedby={describedBy("gameId")}>
                <option value="">Choose a game</option>
                {games.map((game) => <option key={game._id} value={game._id}>{game.title}</option>)}
              </select>
              {games.length === 0 && <p className="field__hint">No games in the library yet, so reviews can't be written yet.</p>}
              {problems.gameId && <p id="gameId-error" className="field__error">{problems.gameId}</p>}
            </div>
          )}

          {isReview && editing && form.gameTitle && (
            <p className="field__hint">Reviewing <strong>{form.gameTitle}</strong></p>
          )}

          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" name="title" className="input" value={form.title} onChange={update} maxLength={LIMITS.title} aria-invalid={Boolean(problems.title)} aria-describedby={describedBy("title")} />
            {problems.title && <p id="title-error" className="field__error">{problems.title}</p>}
          </div>

          <div className="field">
            <label htmlFor="body">Post</label>
            <textarea id="body" name="body" className="textarea" rows={10} value={form.body} onChange={update} maxLength={LIMITS.body} aria-invalid={Boolean(problems.body)} aria-describedby={["body-count", describedBy("body")].filter(Boolean).join(" ")} />
            <p id="body-count" className="field__hint">{form.body.length.toLocaleString()} / {LIMITS.body.toLocaleString()} characters</p>
            {problems.body && <p id="body-error" className="field__error">{problems.body}</p>}
          </div>

          {isReview && (
            <div className="field-row">
              <div className="field">
                <label htmlFor="rating">Rating out of 10</label>
                <select id="rating" name="rating" className="select" value={form.rating} onChange={update} aria-invalid={Boolean(problems.rating)} aria-describedby={describedBy("rating")}>
                  <option value="">Choose</option>
                  {Array.from({ length: 10 }, (_, index) => 10 - index).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                {problems.rating && <p id="rating-error" className="field__error">{problems.rating}</p>}
              </div>
              <fieldset className="field">
                <legend>Would you recommend it?</legend>
                <div className="choice-row">
                  <label className="choice"><input type="radio" name="recommend" value="yes" checked={form.recommend === "yes"} onChange={update} />Yes</label>
                  <label className="choice"><input type="radio" name="recommend" value="no" checked={form.recommend === "no"} onChange={update} />No</label>
                  <label className="choice"><input type="radio" name="recommend" value="" checked={form.recommend === ""} onChange={update} />Skip</label>
                </div>
              </fieldset>
            </div>
          )}

          {formError && <p className="form-error" role="alert">{formError}</p>}

          <div className="form-actions">
            <button type="submit" className="button button--primary">{saving ? "Saving..." : editing ? "Save changes" : "Publish post"}</button>
            <Link className="button" to={editing ? `/posts/${id}` : "/"}>Cancel</Link>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
