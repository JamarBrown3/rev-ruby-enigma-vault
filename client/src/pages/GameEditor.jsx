// Admin: add a game (/admin/games/new) or edit one (/admin/games/:id/edit).
// Form on the left, live card preview on the right, like the GameForm in my
// video_gameStore. The checks match pickGameFields() in server/controllers/games.js.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import GameCard from "../components/GameCard.jsx";
import DeleteButton from "../components/DeleteButton.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import gamesApi from "../services/gamesApi.js";
import { messageFor } from "../services/request.js";
import usePageTitle from "../hooks/usePageTitle.js";

const MAX_YEAR = new Date().getFullYear() + 1;
const PLATFORMS = ["PC", "PlayStation 5", "PlayStation 4", "Xbox Series X|S", "Nintendo Switch", "Nintendo Switch 2", "Steam Deck", "Mobile"];
const GENRES = ["Action", "Adventure", "RPG", "JRPG", "Platformer", "Shooter", "Strategy", "Simulation", "Racing", "Fighting", "Puzzle", "Horror", "Roguelike", "Metroidvania"];
const EMPTY = { title: "", description: "", platform: "", genre: "", releaseYear: "", coverImage: "", headerImage: "", playtimeHours: "" };

// https://... or a path on this site like /images/covers/game.jpg
const isImageAddress = (value) => /^https:\/\/\S+$/.test(value) || /^\/[^\s/]\S*$/.test(value);

function checkGame(form) {
  const problems = {};
  const required = { title: 200, description: 10000, platform: 100, genre: 100 };
  for (const [name, max] of Object.entries(required)) {
    if (!form[name].trim()) problems[name] = "This one is required.";
    else if (form[name].length > max) problems[name] = `Keep it under ${max.toLocaleString()} characters.`;
  }
  const year = Number(form.releaseYear);
  if (!Number.isInteger(year) || year < 1950 || year > MAX_YEAR) problems.releaseYear = `Enter a year from 1950 to ${MAX_YEAR}.`;
  if (!isImageAddress(form.coverImage.trim())) problems.coverImage = "Use an https:// link or a site path that starts with /.";
  if (form.headerImage.trim() && !isImageAddress(form.headerImage.trim())) problems.headerImage = "Use an https:// link or a site path that starts with /.";
  if (form.playtimeHours !== "" && !(Number(form.playtimeHours) >= 0)) problems.playtimeHours = "Use a number of 0 or more.";
  return problems;
}

// Only the fields the server accepts, with numbers sent as numbers.
function buildBody(form) {
  const body = {
    title: form.title.trim(),
    description: form.description.trim(),
    platform: form.platform.trim(),
    genre: form.genre.trim(),
    releaseYear: Number(form.releaseYear),
    coverImage: form.coverImage.trim(),
  };
  if (form.headerImage.trim()) body.headerImage = form.headerImage.trim();
  if (form.playtimeHours !== "") body.playtimeHours = Number(form.playtimeHours);
  return body;
}

export default function GameEditor() {
  const { id } = useParams();
  const editing = Boolean(id);
  usePageTitle(editing ? "Edit game" : "Add a game");
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [problems, setProblems] = useState({});
  const [error, setError] = useState("");
  const [status, setStatus] = useState(editing ? "loading" : "ready");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (!editing) return undefined;
    let ignore = false;
    gamesApi
      .get(id)
      .then((game) => {
        if (ignore) return;
        // Inputs hold text, so turn every saved value into a string.
        setForm(Object.fromEntries(Object.keys(EMPTY).map((key) => [key, game[key] === undefined || game[key] === null ? "" : String(game[key])])));
        setStatus("ready");
      })
      .catch((problem) => {
        if (ignore) return;
        setError(problem.message);
        setStatus("error");
      });
    return () => {
      ignore = true;
    };
  }, [editing, id]);

  function update(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setProblems((previous) => ({ ...previous, [name]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const found = checkGame(form);
    setProblems(found);
    if (Object.keys(found).length) return;

    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const saved = editing ? await gamesApi.update(id, buildBody(form)) : await gamesApi.create(buildBody(form));
      navigate(`/games/${saved._id}`);
    } catch (problem) {
      setError(messageFor(problem, { 401: "Your admin session ended. Sign in again at /admin/login.", 403: "Only the admin can change games." }));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  if (status === "loading") return <div className="page"><StatusMessage kind="loading" title="Loading the game" /></div>;
  if (status === "error") {
    return (
      <div className="page">
        <StatusMessage kind="error" title="This game didn't load." action={<Link className="button" to="/games">Back to the library</Link>}>{error}</StatusMessage>
      </div>
    );
  }

  const field = (name, label, props = {}) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" value={form[name]} onChange={update} aria-invalid={Boolean(problems[name])} aria-describedby={problems[name] ? `${name}-error` : props.hint ? `${name}-hint` : undefined} {...props.input} />
      {props.hint && <p id={`${name}-hint`} className="field__hint">{props.hint}</p>}
      {problems[name] && <p id={`${name}-error`} className="field__error">{problems[name]}</p>}
    </div>
  );

  const preview = { ...form, releaseYear: form.releaseYear ? Number(form.releaseYear) : "", playtimeHours: form.playtimeHours === "" ? undefined : Number(form.playtimeHours) };

  return (
    <div className="page">
      <Link className="back-link" to={editing ? `/games/${id}` : "/games"}>{editing ? "Back to the game" : "Back to the library"}</Link>
      <header className="page-head">
        <h1>{editing ? "Edit game" : "Add a game"}</h1>
        <p>Games are part of the public library. Members can review any game you add here.</p>
      </header>

      <div className="editor">
        <form className="panel" onSubmit={handleSubmit} noValidate>
          <fieldset disabled={saving}>
            {field("title", "Title", { input: { maxLength: 200 } })}
            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea id="description" name="description" className="textarea" rows={6} value={form.description} onChange={update} maxLength={10000} aria-invalid={Boolean(problems.description)} aria-describedby={problems.description ? "description-error" : undefined} />
              {problems.description && <p id="description-error" className="field__error">{problems.description}</p>}
            </div>
            <div className="field-row">
              {field("platform", "Platform", { input: { list: "platform-options", maxLength: 100 } })}
              {field("genre", "Genre", { input: { list: "genre-options", maxLength: 100 } })}
            </div>
            <div className="field-row">
              {field("releaseYear", "Release year", { input: { type: "number", inputMode: "numeric", min: 1950, max: MAX_YEAR, step: 1 } })}
              {field("playtimeHours", "Hours played (optional)", { input: { type: "number", inputMode: "decimal", min: 0, step: 0.5 } })}
            </div>
            {field("coverImage", "Cover image", { hint: "An https:// link, or a file in client/public such as /images/covers/game.jpg", input: { placeholder: "/images/covers/game.jpg" } })}
            {field("headerImage", "Banner image (optional)", { hint: "Wide image for the top of the game's page.", input: {} })}

            <datalist id="platform-options">{PLATFORMS.map((name) => <option key={name} value={name} />)}</datalist>
            <datalist id="genre-options">{GENRES.map((name) => <option key={name} value={name} />)}</datalist>

            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-actions">
              <button type="submit" className="button button--primary">{saving ? "Saving..." : editing ? "Save changes" : "Add game"}</button>
              <Link className="button" to={editing ? `/games/${id}` : "/games"}>Cancel</Link>
            </div>
          </fieldset>

          {editing && (
            <div className="editor__danger">
              <DeleteButton
                itemName={form.title || "this game"}
                label="Delete game"
                disabled={saving}
                onDelete={async () => {
                  await gamesApi.remove(id);
                  navigate("/games");
                }}
              />
            </div>
          )}
        </form>

        <aside className="editor__preview" aria-label="Preview">
          <h2 className="editor__preview-label">Preview</h2>
          {/* key: a new cover address redraws the card, so a fixed link replaces a broken one */}
          <GameCard key={form.coverImage} game={preview} preview />
        </aside>
      </div>
    </div>
  );
}
