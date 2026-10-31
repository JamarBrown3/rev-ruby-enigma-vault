// Games: anyone can list/view; only the admin can create, edit, delete.
import { useState } from "react";
import JsonBox from "./JsonBox.jsx";

export const SAMPLE_GAME = {
  title: "Dev Test Game",
  description: "Created by the route tester. Safe to delete.",
  platform: "PC",
  genre: "RPG",
  releaseYear: 2024,
  coverImage: "https://example.com/cover.jpg",
  playtimeHours: 12.5,
};

export default function GamesPanel({ run, ids, setIds }) {
  const [page, setPage] = useState("1");
  const [createBody, setCreateBody] = useState(JSON.stringify(SAMPLE_GAME, null, 2));
  const [updateBody, setUpdateBody] = useState(JSON.stringify({ playtimeHours: 40 }, null, 2));
  const id = ids.game;
  const setId = (game) => setIds((old) => ({ ...old, game }));

  async function create() {
    const result = await run("Create game", "POST", "/api/games", JSON.parse(createBody));
    if (result.status === 201) setId(result.data._id);
  }

  return (
    <div className="panel">
      <div className="row">
        <label>Page <input value={page} onChange={(event) => setPage(event.target.value)} size={4} /></label>
        <button onClick={() => run("List games", "GET", `/api/games?page=${encodeURIComponent(page)}`)}>List games</button>
      </div>

      <label>Game ID (filled in after Create) <input value={id} onChange={(event) => setId(event.target.value.trim())} size={30} /></label>
      <div className="row">
        <button onClick={() => run("Get one game", "GET", `/api/games/${id}`)}>Get this game</button>
        <button onClick={() => run("Update game", "PATCH", `/api/games/${id}`, JSON.parse(updateBody))}>Update (PATCH)</button>
        <button onClick={() => run("Delete game", "DELETE", `/api/games/${id}`)}>Delete</button>
      </div>

      <div className="two">
        <div>
          <JsonBox label="Create body" value={createBody} onChange={setCreateBody} />
          <button onClick={create}>Create game (admin)</button>
        </div>
        <JsonBox label="Update body" value={updateBody} onChange={setUpdateBody} />
      </div>
    </div>
  );
}
