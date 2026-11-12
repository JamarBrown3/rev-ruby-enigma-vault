// Like / dislike buttons for one post.
// Visitors see the totals and a sign-in link; members can vote.
// Pressing the button you already pressed removes your vote.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import votesApi from "../services/voteApi.js";
import { messageFor } from "../services/request.js";
import { plural } from "../utils/format.js";

export default function VoteButtons({ postId }) {
  const { user } = useAuth();
  const [votes, setVotes] = useState({ likes: 0, dislikes: 0, myVote: null }); // {likes, dislikes, myVote}
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(""); // read aloud by screen readers
  const inFlight = useRef(false); // blocks a double click from sending two votes

  // Load the totals. Signed in: also load which button I pressed.
  useEffect(() => {
    let ignore = false;
    setStatus("loading");
    const load = user ? votesApi.mine(postId) : votesApi.totals(postId);
    load
      .then((found) => {
        if (ignore) return; // ignore if unmounted
        setVotes({ myVote: null, ...found });
        setStatus("ready");
      })
      .catch(() => {
        if (!ignore) setStatus("error");
      });
    return () => {
      ignore = true;
    };
  }, [postId, user]);

  async function vote(value) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setMessage("");

    // If I pressed the same button again, remove my vote; otherwise set my vote to the new value.
    try {
      const pressedAgain = votes.myVote === value;
      const result = pressedAgain
        ? await votesApi.clear(postId)
        : await votesApi.set(postId, value);
      setVotes(result); // the server sends back the new totals
      if (pressedAgain) setMessage("Vote removed.");
      else
        setMessage(
          value === 1 ? "You liked this post." : "You disliked this post.",
        );
    } catch (problem) {
      // the server rejected the vote
      setMessage(messageFor(problem));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  if (status === "loading")
    return <p className="votes__note">Loading likes...</p>; // show the totals when ready, or an error message
  if (status === "error")
    return (
      <p className="votes__note">Likes didn't load. Refresh to try again.</p>
    ); // show the totals when ready, or an error message
  // Visitors: plain text totals, no buttons that can't be used.
  if (!user) {
    return (
      <p className="votes__note">
        {plural(votes.likes, "like")} · {plural(votes.dislikes, "dislike")} ·{" "}
        <Link to="/login">Sign in to vote</Link>
      </p>
    );
  }

  return (
    <div className="votes">
      <div className="votes__buttons" role="group" aria-label="Rate this post">
        {/* aria-pressed makes these toggle buttons: VoiceOver says "selected" */}
        <button
          type="button"
          className="votes__button votes__button--like"
          aria-pressed={votes.myVote === 1}
          aria-disabled={pending}
          onClick={() => vote(1)}
        >
          <span aria-hidden="true">👍</span> Like{" "}
          <span className="votes__count">{votes.likes}</span>
        </button>
        <button
          type="button"
          className="votes__button votes__button--dislike"
          aria-pressed={votes.myVote === -1}
          aria-disabled={pending}
          onClick={() => vote(-1)}
        >
          <span aria-hidden="true">👎</span> Dislike{" "}
          <span className="votes__count">{votes.dislikes}</span>
        </button>
      </div>
      {/* role="status": screen readers announce changes here without moving focus */}
      <p className="visually-hidden" role="status">
        {message}
      </p>
    </div>
  );
}
