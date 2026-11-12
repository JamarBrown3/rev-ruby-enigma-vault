// The comments under one post: the list, a box to add one, and edit/delete for your own. Three small components in one file:
// Comments    - loads the list and keeps it in state
// CommentItem - one comment (shows Edit/Delete only to its author)
// CommentForm - the text box, used for BOTH new comments and edits

import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import commentsApi, {
  COMMENTS_PER_PAGE,
  COMMENT_MAX,
} from "../services/commentsApi.js";
import { messageFor } from "../services/request.js";
import { formatDate } from "../utils/format.js";
import DeleteButton from "./DeleteButton.jsx";
import StatusMessage from "./StatusMessage.jsx";

// SECTION 1: THE LIST -------------

export default function Comments({ postId }) {
  const { user } = useAuth(); // user is null if not signed in
  const [comments, setComments] = useState([]); // the comments we have loaded so far
  const [page, setPage] = useState(1); // the page we are currently showing (1-based)
  const [hasMore, setHasMore] = useState(false); // whether there are more pages to load
  const [status, setStatus] = useState("loading"); // "loading" | "error" | "ready"
  const [loadingMore, setLoadingMore] = useState(false); // true while loading more comments
  const [announcement, setAnnouncement] = useState(""); // read aloud by screen readers when comments are added/edited/deleted
  const [focusId, setFocusId] = useState(null); // the comment to move focus to after a change
  const newCommentBox = useRef(null); // focus the new comment box after a comment is added

  // load page 1 when the post changes.
  useEffect(() => {
    let ignore = false;
    setStatus("loading");
    commentsApi
      .list(postId, 1)
      .then((found) => {
        if (ignore) return;
        setComments(found);
        setPage(1);
        setHasMore(found.length === COMMENTS_PER_PAGE); // a full page means there may be more
        setStatus("ready");
      })
      .catch(() => {
        if (!ignore) setStatus("error");
      });
    return () => {
      ignore = true;
    };
  }, [postId]);

  // After posting or editing, move focus to that comment so keyboard and
  // screen reader users land on what they just did.
  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`comment-${focusId}`)?.focus();
    setFocusId(null);
  }, [focusId]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await commentsApi.list(postId, page + 1);
      // Skip any comment we already have (someone may have posted in between).
      setComments((current) => {
        const seen = new Set(current.map((comment) => comment._id));
        return [
          ...current,
          ...next.filter((comment) => !seen.has(comment._id)),
        ];
      });
      setPage(page + 1);
      setHasMore(next.length === COMMENTS_PER_PAGE);
    } catch (problem) {
      setAnnouncement(messageFor(problem));
    } finally {
      setLoadingMore(false);
    }
  }

  // adding a comment is only possible if the user is signed in, so we don't need to check for that here.
  async function addComment(text) {
    const created = await commentsApi.create(postId, text);
    setComments((current) => [...current, created]);
    setAnnouncement("Comment posted.");
    setFocusId(created._id);
  }

  // editing a comment is only possible if the user is signed in and is the author, so we don't need to check for that here.
  async function saveEdit(commentId, text) {
    const updated = await commentsApi.update(postId, commentId, text);
    setComments((current) =>
      current.map((comment) => (comment._id === commentId ? updated : comment)),
    );
    setAnnouncement("Comment updated.");
    setFocusId(commentId);
  }

  // deleting a comment is only possible if the user is signed in and is the author, so we don't need to check for that here.
  async function deleteComment(commentId) {
    await commentsApi.remove(postId, commentId);
    setComments((current) =>
      current.filter((comment) => comment._id !== commentId),
    );
    setAnnouncement("Comment deleted.");
    newCommentBox.current?.focus(); // the delete comment is gone, so focus goes somwhere safe
  }

  return (
    <section className="section comments" aria-labelledby="comments-title">
      <h2 id="comments-title" className="comments__title">
        Comments{status === "ready" && !hasMore ? ` (${comments.length})` : ""}
      </h2>

      {/* The announcement is for screen readers only. It is updated when a comment is added, edited, or deleted. */}
      {status === "loading" && (
        <StatusMessage kind="loading" title="loading comments" />
      )}
      {status === "error" && (
        <StatusMessage kind="error" title="Comments didn't load.">
          Refresh the page to try again.
        </StatusMessage>
      )}

      {/* this is for adding a new comment */}
      {status === "ready" && comments.length === 0 && (
        <p className="comments__empty">
          No comments yet. {user ? "Start the conversation below." : ""}
        </p>
      )}

      {/* this is for displaying the list of comments */}
      {status === "ready" && comments.length > 0 && (
        <ol className="comments__list">
          {comments.map((comment) => (
            <CommentItem
              key={comment._id}
              comment={comment}
              isMine={Boolean(user && comment.authorId?._id === user.id)}
              onSave={(text) => saveEdit(comment._id, text)}
              onDelete={() => deleteComment(comment._id)}
            />
          ))}
        </ol>
      )}

      {/* this is for loading more comments */}
      {hasMore && (
        <button
          type="button"
          className="button"
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading..." : "Load more comments"}
        </button>
      )}

      {user ? (
        <CommentForm
          label="Add a comment"
          submitLabel="Post comment"
          onSubmit={addComment}
          textareaRef={newCommentBox}
        />
      ) : (
        <p className="comments__signin">
          <Link to="/login">Sign in</Link> to join the conversation.
        </p>
      )}

      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </section>
  );
}

// SECTION 2: ONE COMMENT -------------

function CommentItem({ comment, isMine, onSave, onDelete }) {
  const [editing, setEditing] = useState(false); // true if the user is editing this comment
  const editButton = useRef(null); // focus this after saving or canceling an edit
  const author = comment.authorId?.username ?? "Former member"; // if the author was deleted, show this instead of nothing
  const edited =
    new Date(comment.updatedAt) - new Date(comment.createdAt) > 60_000; // if the comment was edited more than a minute after it was created, show "edited"

  return (
    // tabIndex={-1}: not in the Tab order, but the code can move focus here.
    <li id={`comment-${comment._id}`} className="comment" tabIndex={-1}>
      <p className="comment__meta">
        <strong>{author}</strong> · {""}
        <time dateTime={comment.createdAt}>
          {formatDate(comment.createdAt)}
        </time>
        {edited && <span> (edited)</span>}
      </p>

      {editing ? (
        <CommentForm
          label="Edit your comment"
          submitLabel="Save changes"
          initialText={comment.body}
          autoFocus
          onSubmit={async (text) => {
            await onSave(text);
            setEditing(false);
          }}
          onCancel={() => {
            setEditing(false);
            // Wait one frame for the edit button to come back, then focus it.
            requestAnimationFrame(() => editButton.current?.focus());
          }}
        />
      ) : (
        <p className="comment__body">{comment.body}</p>
      )}

      {isMine && !editing && (
        <div className="comment__actions">
          <button
            ref={editButton}
            type="button"
            className="button button--small"
            onClick={() => setEditing(true)}
          >
            Edit <span className="visually-hidden">your comment</span>
          </button>
          <DeleteButton
            small
            itemName="your comment"
            label="Delete"
            onDelete={onDelete}
          />
        </div>
      )}
    </li>
  );
}

// SECTION 3: THE TEXT BOX FOR (new comment AND edit) -------------

function CommentForm({
  label,
  submitLabel,
  initialText = "",
  autoFocus = false,
  onSubmit,
  onCancel,
  textareaRef,
}) {
  const [text, setText] = useState(initialText); // the text in the textarea
  const [error, setError] = useState(""); // error message to show if the submission fails
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false); // blocks a double click from posting twice
  const id = useId(); // unique ids so label, hint and error connect to THIS box
  const length = text.trim().length; // the length of the text, ignoring whitespace

  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;

    // Same rules as the server, checked first so people get a quick answer.
    if (length === 0) return setError("Write something before posting.");
    if (length > COMMENT_MAX)
      return setError(`Comment can be up to ${COMMENT_MAX} characters long.`);

    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      await onSubmit(text.trim());
      if (!initialText) setText(""); // a new comment clears the box; an edit closes instead
    } catch (problem) {
      setError(messageFor(problem));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form className="comment-form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor={`${id}-text`}>{label}</label>
        <textarea
          ref={textareaRef}
          id={`${id}-text`}
          rows={4}
          value={text}
          autoFocus={autoFocus}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-count ${id}-error` : `${id}-count`}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && onCancel) onCancel();
          }}
        />

        {/* the comment field hint is the character count and we are checking the length of the text */}
        <p
          id={`${id}-count`}
          className={`field__hint${length > COMMENT_MAX ? " comment-form__over" : ""}`}
        >
          {length} / {COMMENT_MAX} characters
        </p>
        {error && (
          <p id={`${id}-error`} className="field__error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="comment-form__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={pending}
        >
          {pending ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            className="button"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
