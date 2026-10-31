// One-click check lists. Pick the list that matches who is signed in:
//   Visitor  = signed out           -> everything private should say 401
//   Member   = a normal account     -> admin things should say 403
//   Admin    = you, with the code   -> admin things should work
// Each step says what status it expects; the log marks PASS or FAIL.
// Everything the checks create is deleted again at the end.
import { useState } from "react";
import { SAMPLE_GAME } from "./GamesPanel.jsx";

const FAKE_ID = "000000000000000000000000"; // valid shape, but no record has it

async function visitorChecks(run) {
  await run("Visitor: who am I", "GET", "/api/auth/me", undefined, { expect: 401 });
  await run("Visitor: list games (public)", "GET", "/api/games", undefined, { expect: 200 });
  await run("Visitor: list posts (public)", "GET", "/api/posts", undefined, { expect: 200 });
  await run("Visitor: create game", "POST", "/api/games", SAMPLE_GAME, { expect: 401 });
  await run("Visitor: create post", "POST", "/api/posts", { title: "x", body: "x" }, { expect: 401 });
  await run("Visitor: admin area", "GET", "/api/admin", undefined, { expect: 401 });
  await run("Visitor: admin dashboard", "GET", "/api/dashboard", undefined, { expect: 401 });
}

async function memberChecks(run) {
  await run("Member: who am I", "GET", "/api/auth/me", undefined, { expect: 200 });
  await run("Member: create game (admin only)", "POST", "/api/games", SAMPLE_GAME, { expect: 403 });
  await run("Member: edit game (admin only)", "PATCH", `/api/games/${FAKE_ID}`, { playtimeHours: 1 }, { expect: 403 });
  await run("Member: delete game (admin only)", "DELETE", `/api/games/${FAKE_ID}`, undefined, { expect: 403 });
  await run("Member: admin area", "GET", "/api/admin", undefined, { expect: 403 });
  await run("Member: admin dashboard", "GET", "/api/dashboard", undefined, { expect: 403 });

  const post = await run("Member: create discussion", "POST", "/api/posts", { kind: "discussion", title: "Check post", body: "Safe to delete." }, { expect: 201 });
  if (post.status !== 201) return;
  const id = post.data._id;
  await run("Member: post without CSRF token", "POST", "/api/posts", { title: "x", body: "x" }, { expect: 403, skipCsrf: true });
  await run("Member: edit own post", "PATCH", `/api/posts/${id}`, { body: "Edited." }, { expect: 200 });
  await run("Member: add rating to a discussion", "PATCH", `/api/posts/${id}`, { rating: 5 }, { expect: 400 });
  await run("Member: someone else's / missing post", "PATCH", `/api/posts/${FAKE_ID}`, { body: "x" }, { expect: 404 });
  await run("Member: delete own post", "DELETE", `/api/posts/${id}`, undefined, { expect: 204 });
}

async function adminChecks(run) {
  const me = await run("Admin: who am I", "GET", "/api/auth/me", undefined, { expect: 200 });
  if (me.data?.user?.role !== "admin") return;
  await run("Admin: admin area guard (nothing built yet = 404)", "GET", "/api/admin", undefined, { expect: 404 });
  await run("Admin: dashboard guard (nothing built yet = 404)", "GET", "/api/dashboard", undefined, { expect: 404 });

  // Bad input must be refused (400) and never saved.
  await run("Admin: year 1800", "POST", "/api/games", { ...SAMPLE_GAME, releaseYear: 1800 }, { expect: 400 });
  await run("Admin: year as text", "POST", "/api/games", { ...SAMPLE_GAME, releaseYear: "2024" }, { expect: 400 });
  await run("Admin: negative playtime", "POST", "/api/games", { ...SAMPLE_GAME, playtimeHours: -5 }, { expect: 400 });
  await run("Admin: sneaky extra field", "POST", "/api/games", { ...SAMPLE_GAME, role: "admin" }, { expect: 400 });
  await run("Admin: javascript: image link", "POST", "/api/games", { ...SAMPLE_GAME, coverImage: "javascript:alert(1)" }, { expect: 400 });
  await run("Admin: missing title", "POST", "/api/games", { ...SAMPLE_GAME, title: undefined }, { expect: 400 });
  await run("Admin: create without CSRF token", "POST", "/api/games", SAMPLE_GAME, { expect: 403, skipCsrf: true });

  // The happy path: create -> edit -> review blocks delete -> delete.
  const game = await run("Admin: create game", "POST", "/api/games", SAMPLE_GAME, { expect: 201 });
  if (game.status !== 201) return;
  const gameId = game.data._id;
  await run("Admin: view new game", "GET", `/api/games/${gameId}`, undefined, { expect: 200 });
  await run("Admin: edit game", "PATCH", `/api/games/${gameId}`, { playtimeHours: 40 }, { expect: 200 });
  // A malformed ID gets 404 on purpose (security/access.js readObjectId), same as a missing one.
  await run("Admin: edit with bad ID", "PATCH", "/api/games/not-an-id", { playtimeHours: 1 }, { expect: 404 });
  await run("Admin: edit missing game", "PATCH", `/api/games/${FAKE_ID}`, { playtimeHours: 1 }, { expect: 404 });

  const review = await run("Admin: write a review of it", "POST", "/api/posts", { kind: "review", title: "Check review", body: "Safe to delete.", gameId, rating: 8, recommend: true }, { expect: 201 });
  if (review.status === 201) {
    await run("Admin: change review rating", "PATCH", `/api/posts/${review.data._id}`, { rating: 9 }, { expect: 200 });
    await run("Admin: delete game that has a review", "DELETE", `/api/games/${gameId}`, undefined, { expect: 409 });
    await run("Admin: delete the review", "DELETE", `/api/posts/${review.data._id}`, undefined, { expect: 204 });
  }
  await run("Admin: delete game", "DELETE", `/api/games/${gameId}`, undefined, { expect: 204 });
  await run("Admin: game is gone", "GET", `/api/games/${gameId}`, undefined, { expect: 404 });
}

export default function AdminPanel({ run, user }) {
  const [busy, setBusy] = useState(false);
  async function start(checks) {
    setBusy(true);
    try {
      await checks(run);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel">
      <p>Signed in as: <b>{user ? `${user.username} (${user.role})` : "nobody (visitor)"}</b>. Run the list that matches.</p>
      <div className="row">
        <button disabled={busy || !!user} onClick={() => start(visitorChecks)}>Run visitor checks</button>
        <button disabled={busy || !user || user.role === "admin"} onClick={() => start(memberChecks)}>Run member checks</button>
        <button disabled={busy || user?.role !== "admin"} onClick={() => start(adminChecks)}>Run admin checks</button>
        <button disabled={busy} onClick={() => run("Server health", "GET", "/api/health", undefined, { expect: 200 })}>Server health</button>
        <button disabled={busy} onClick={() => run("Database health", "GET", "/api/health/database", undefined, { expect: 200 })}>Database health</button>
      </div>
      <p className="hint">
        Full test = log out → visitor checks → log in as a test member → member checks → log out →
        log in as admin with your code → admin checks → log out. Then "Copy log" if you want ChatGPT to read it.
      </p>
    </div>
  );
}
