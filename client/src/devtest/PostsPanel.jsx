// Posts: anyone can read; signed-in users create; only the AUTHOR can edit/delete.
import { useState } from "react";
import JsonBox from "./JsonBox.jsx";

export default function PostsPanel({ run, ids, setIds }) {
  const [createBody, setCreateBody] = useState(
    JSON.stringify({ kind: "discussion", title: "Dev test post", body: "Safe to delete." }, null, 2),
  );
  const [updateBody, setUpdateBody] = useState(JSON.stringify({ body: "Edited by the route tester." }, null, 2));
  const id = ids.post;
  const setId = (post) => setIds((old) => ({ ...old, post }));

  function useReviewTemplate() {
    setCreateBody(JSON.stringify(
      { kind: "review", title: "Dev test review", body: "Safe to delete.", gameId: ids.game || "PASTE_A_GAME_ID", rating: 8, recommend: true },
      null, 2,
    ));
  }

  async function create() {
    const result = await run("Create post", "POST", "/api/posts", JSON.parse(createBody));
    if (result.status === 201) setId(result.data._id);
  }

  return (
    <div className="panel">
      <div className="row">
        <button onClick={() => run("List posts", "GET", "/api/posts?page=1")}>List posts</button>
        <button disabled={!ids.game} onClick={() => run("Posts for this game", "GET", `/api/posts?gameId=${ids.game}`)}>Posts for game {ids.game ? "" : "(create a game first)"}</button>
      </div>

      <label>Post ID (filled in after Create) <input value={id} onChange={(event) => setId(event.target.value.trim())} size={30} /></label>
      <div className="row">
        <button onClick={() => run("Get one post", "GET", `/api/posts/${id}`)}>Get this post</button>
        <button onClick={() => run("Update post", "PATCH", `/api/posts/${id}`, JSON.parse(updateBody))}>Update (PATCH)</button>
        <button onClick={() => run("Delete post", "DELETE", `/api/posts/${id}`)}>Delete</button>
      </div>

      <div className="two">
        <div>
          <JsonBox label="Create body" value={createBody} onChange={setCreateBody} />
          <div className="row">
            <button onClick={create}>Create post</button>
            <button onClick={useReviewTemplate}>Use review template</button>
          </div>
        </div>
        <div>
          <JsonBox label="Update body" value={updateBody} onChange={setUpdateBody} />
          <div className="row">
            <button onClick={() => setUpdateBody(JSON.stringify({ rating: 9 }, null, 2))}>Template: change rating</button>
          </div>
        </div>
      </div>
      <p className="hint">Changing a review's rating should give 200; adding a rating to a discussion should give 400.</p>
    </div>
  );
}
