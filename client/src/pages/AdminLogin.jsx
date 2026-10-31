// Owner sign-in: email, password AND the 6-digit code from your authenticator
// app. Not linked anywhere on the site; bookmark /admin/login.
// Finding this page doesn't help anyone: the server still needs your password
// and a fresh code, and it rate-limits every attempt.
import { useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { messageFor } from "../services/request.js";
import usePageTitle from "../hooks/usePageTitle.js";
import { PasswordInput } from "./Login.jsx";

export default function AdminLogin() {
  usePageTitle("Owner sign-in");
  const { user, checking, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  if (!checking && user?.role === "admin") return <Navigate to="/admin/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    const digits = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(digits)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const signedIn = await login({ email: email.trim(), password, code: digits });
      navigate(signedIn.role === "admin" ? "/admin/dashboard" : "/", { replace: true });
    } catch (problem) {
      setError(
        messageFor(problem, {
          401: "That didn't work. Check your email and password, then wait for a new code and try again (each code works once).",
        }),
      );
      setPassword("");
      setCode("");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div className="page page--narrow">
      <form className="panel owner-login" onSubmit={handleSubmit} noValidate>
        <h1 className="owner-login__title">Owner sign-in</h1>
        <p className="owner-login__intro">For the site owner. You'll need the 6-digit code from your authenticator app.</p>
        <fieldset disabled={pending}>
          <div className="field">
            <label htmlFor="owner-email">Email</label>
            <input id="owner-email" className="input" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="owner-password">Password</label>
            <PasswordInput id="owner-password" autoComplete="current-password" value={password} onChange={setPassword} />
          </div>
          <div className="field">
            <label htmlFor="owner-code">6-digit code</label>
            <input
              id="owner-code"
              className="input owner-login__code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={7}
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^\d ]/g, ""))}
            />
            <p className="field__hint">Codes change every 30 seconds and each one works once.</p>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="button button--primary">{pending ? "Checking..." : "Sign in"}</button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
