// A small text box for typing a JSON request body. Shows an error if the JSON is broken.
export default function JsonBox({ label, value, onChange }) {
  let error = "";
  try {
    JSON.parse(value);
  } catch {
    error = "Not valid JSON yet";
  }
  return (
    <label className="json">
      {label} {error && <span className="fail">{error}</span>}
      <textarea rows={8} value={value} onChange={(event) => onChange(event.target.value)} spellCheck={false} />
    </label>
  );
}
