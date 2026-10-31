// Delete with an inline "are you sure?" box instead of a browser pop-up.
// Taken from DeleteGameButton.jsx in my video_gameStore and made generic so
// posts and games can both use it.
import { useId, useRef, useState } from "react";

export default function DeleteButton({ itemName, onDelete, label = "Delete", disabled = false, small = false }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false); // blocks a double click from deleting twice
  const trigger = useRef(null);
  const messageId = useId();

  function cancel() {
    if (inFlight.current) return;
    setConfirming(false);
    setError("");
    trigger.current?.focus();
  }

  async function confirm() {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      await onDelete();
      setConfirming(false);
    } catch (problem) {
      setError(problem.message || "Couldn't delete it. Try again.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div className="delete-control">
      <button
        ref={trigger}
        type="button"
        className={`button button--danger${small ? " button--small" : ""}`}
        disabled={disabled || pending}
        aria-expanded={confirming}
        onClick={() => setConfirming(true)}
      >
        {label}
      </button>

      {confirming && (
        <div
          className="confirm"
          role="group"
          aria-labelledby={messageId}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
        >
          <p id={messageId}>Delete "{itemName}"? This can't be undone.</p>
          {error && (
            <p role="alert" className="field__error">
              {error}
            </p>
          )}
          <div className="confirm__actions">
            <button type="button" className="button button--small" autoFocus disabled={pending} onClick={cancel}>
              Keep it
            </button>
            <button type="button" className="button button--primary button--small" disabled={pending} onClick={confirm}>
              {pending ? "Deleting..." : "Yes, delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
