// Loading, empty and error states in one place, so every page explains what's
// happening and what to do next.
//   kind: "loading" | "empty" | "error"
export default function StatusMessage({ kind = "empty", title, children, action }) {
  const role = kind === "error" ? "alert" : "status";
  return (
    <div className={`status status--${kind}`} role={role}>
      {kind === "loading" && <span className="status__spinner" aria-hidden="true" />}
      <div>
        {title && <p className="status__title">{title}</p>}
        {children && <div className="status__text">{children}</div>}
        {action && <div className="status__action">{action}</div>}
      </div>
    </div>
  );
}
