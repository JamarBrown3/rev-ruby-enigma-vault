// DEV-ONLY route tester (added 2026-10-31). Not part of the real site.
// Every button calls one backend route and adds a line to the log:
// what was sent, the status that came back, and PASS/FAIL when we know what
// status to expect. Your password and code stay in this browser tab.
import { useState } from "react";
import { api } from "../api.js";
import AuthPanel from "./AuthPanel.jsx";
import GamesPanel from "./GamesPanel.jsx";
import PostsPanel from "./PostsPanel.jsx";
import AdminPanel from "./AdminPanel.jsx";
import "./devtest.css";

const TABS = ["Login", "Games", "Posts", "Admin checks"];

export default function DevTest() {
  const [tab, setTab] = useState("Login");
  const [user, setUser] = useState(null); // { id, username, role } or null
  const [log, setLog] = useState([]);
  const [ids, setIds] = useState({ game: "", post: "" }); // last created IDs

  // run() = call the API + write the result to the log. Panels all use this.
  async function run(label, method, path, body, { expect, skipCsrf } = {}) {
    let result;
    try {
      result = await api(method, path, body, { skipCsrf });
    } catch (error) {
      result = { status: 0, ok: false, data: `Network error: ${error.message}. Is "npm run dev" running in server/?` };
    }
    const pass = expect === undefined ? null : result.status === expect;
    setLog((old) => [{ label, method, path, expect, pass, ...result, at: new Date().toLocaleTimeString() }, ...old]);
    return result;
  }

  const passed = log.filter((entry) => entry.pass === true).length;
  const failed = log.filter((entry) => entry.pass === false).length;
  const shared = { run, user, setUser, ids, setIds };

  return (
    <div className="devtest">
      <header>
        <h1>REV route tester <small>(dev only) <a className="back" href="/">Back to the site</a></small></h1>
        <div className="who">
          {user ? <>Signed in as <b>{user.username}</b> ({user.role})</> : "Not signed in (visitor)"}
        </div>
      </header>

      <nav>
        {TABS.map((name) => (
          <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>
            {name}
          </button>
        ))}
      </nav>

      <main>
        {tab === "Login" && <AuthPanel {...shared} />}
        {tab === "Games" && <GamesPanel {...shared} />}
        {tab === "Posts" && <PostsPanel {...shared} />}
        {tab === "Admin checks" && <AdminPanel {...shared} />}
      </main>

      <section className="log">
        <div className="log-head">
          <h2>Log</h2>
          <span className="pass">{passed} pass</span>
          <span className="fail">{failed} fail</span>
          <button onClick={() => setLog([])}>Clear</button>
          <button onClick={() => navigator.clipboard.writeText(JSON.stringify(log, null, 2))}>Copy log</button>
        </div>
        {log.map((entry, index) => (
          <details key={log.length - index} className={entry.pass === false ? "bad" : entry.pass ? "good" : ""}>
            <summary>
              <span className="time">{entry.at}</span>
              <span className={`dt-status s${String(entry.status)[0]}`}>{entry.status}</span>
              {entry.pass !== null && <span className={entry.pass ? "pass" : "fail"}>{entry.pass ? "PASS" : `FAIL (expected ${entry.expect})`}</span>}
              <b>{entry.method}</b> {entry.path} <i>{entry.label}</i>
            </summary>
            <pre>{typeof entry.data === "string" ? entry.data : JSON.stringify(entry.data, null, 2)}</pre>
          </details>
        ))}
      </section>
    </div>
  );
}
