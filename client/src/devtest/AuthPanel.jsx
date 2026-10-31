// Register, log in (with the 6-digit code for admin), "who am I", log out.
import { useState } from "react";

export default function AuthPanel({ run, setUser }) {
  const [form, setForm] = useState({ username: "", email: "", password: "", code: "" });
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  async function login(event) {
    event.preventDefault();
    const body = { email: form.email, password: form.password };
    if (form.code) body.code = form.code; // only the admin account needs it
    const result = await run("Log in", "POST", "/api/auth/login", body, { expect: 200 });
    if (result.ok) setUser(result.data.user);
    setForm({ ...form, password: "", code: "" }); // don't keep secrets on screen
  }

  async function whoAmI() {
    const result = await run("Who am I", "GET", "/api/auth/me");
    setUser(result.ok ? result.data.user : null);
  }

  async function logout() {
    const result = await run("Log out", "POST", "/api/auth/logout", {}, { expect: 200 });
    if (result.ok) setUser(null);
  }

  async function register() {
    const { username, email, password } = form;
    await run("Register", "POST", "/api/auth/register", { username, email, password }, { expect: 202 });
  }

  return (
    <div className="panel">
      <form onSubmit={login}>
        <label>Email <input name="email" type="email" autoComplete="username" value={form.email} onChange={change} /></label>
        <label>Password <input name="password" type="password" autoComplete="current-password" value={form.password} onChange={change} /></label>
        <label>6-digit code (admin only) <input name="code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={form.code} onChange={change} /></label>
        <label>Username (only for Register) <input name="username" value={form.username} onChange={change} /></label>
        <div className="row">
          <button type="submit">Log in</button>
          <button type="button" onClick={register}>Register test member</button>
          <button type="button" onClick={whoAmI}>Who am I</button>
          <button type="button" onClick={logout}>Log out</button>
        </div>
      </form>
      <p className="hint">
        To test as a normal member: log out, register a throwaway account (e.g. tester1 /
        tester1@example.test), then log in with it - no code needed.
      </p>
    </div>
  );
}
