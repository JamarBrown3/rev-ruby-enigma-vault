// Log in or register (the wireframe's "Enter the vault" page).
// Members only need an email and password. The admin's 6-digit code lives on
// a separate page (/admin/login), so nobody else ever sees a code box.
import { useId, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { safeReturnPath } from "../auth/guards.jsx";
import { messageFor } from "../services/request.js";
import usePageTitle from "../hooks/usePageTitle.js";

// Same rules as server/security/input.js (parseRegistration, readNewPassword).
const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?$/;

function checkRegistration({ username, email, password, confirm }) {
  const problems = {};
  if (username.length < 3 || username.length > 35) problems.username = "Use 3 to 35 characters.";
  else if (!USERNAME_PATTERN.test(username)) problems.username = "Use letters, numbers, _ - or . and start and end with a letter or number.";
  if (!/^\S+@\S+\.\S+$/.test(email)) problems.email = "Enter an email address like name@example.com.";
  if (password.length < 15 || password.length > 128) problems.password = "Use 15 to 128 characters.";
  if (confirm !== password) problems.confirm = "The two passwords don't match.";
  return problems;
}

export default function Login() {
  usePageTitle("Log in");
  const { user, checking } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") === "register" ? "register" : "login");
  const tabsId = useId();
  const loginTab = useRef(null);
  const registerTab = useRef(null);

  const returnTo = safeReturnPath(location.state?.from);

  // Already signed in? Nothing to do here.
  if (!checking && user) return <Navigate to={returnTo} replace />;

  function onTabKey(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const next = tab === "login" ? "register" : "login";
    setTab(next);
    (next === "login" ? loginTab : registerTab).current?.focus();
  }

  return (
    <div className="page access">
      <section className="access__intro">
        <h1>Enter the vault.</h1>
        <p>Members can write reviews, start discussions and edit their own posts. Reading is open to everyone.</p>
      </section>

      <div className="access__card">
        <div className="tabs" role="tablist" aria-label="Log in or register" onKeyDown={onTabKey}>
          <button ref={loginTab} type="button" role="tab" id={`${tabsId}-login`} className="tab" aria-selected={tab === "login"} aria-controls={`${tabsId}-login-panel`} tabIndex={tab === "login" ? 0 : -1} onClick={() => setTab("login")}>
            Log in
          </button>
          <button ref={registerTab} type="button" role="tab" id={`${tabsId}-register`} className="tab" aria-selected={tab === "register"} aria-controls={`${tabsId}-register-panel`} tabIndex={tab === "register" ? 0 : -1} onClick={() => setTab("register")}>
            Register
          </button>
        </div>

        <div className="access__panel" role="tabpanel" id={`${tabsId}-${tab}-panel`} aria-labelledby={`${tabsId}-${tab}`}>
          {tab === "login" ? (
            <LoginForm onDone={() => navigate(returnTo, { replace: true })} />
          ) : (
            <RegisterForm onDone={() => navigate(returnTo, { replace: true })} onUseLogin={() => setTab("login")} />
          )}
        </div>

        <div className="access__guest">
          <p className="access__guest-title">No account needed to look around</p>
          <p>Read every post and browse the game library as a visitor.</p>
          <Link className="button" to="/">Continue without signing in</Link>
        </div>
      </div>
    </div>
  );
}

function LoginForm({ onDone }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      await login({ email: email.trim(), password });
      onDone();
    } catch (problem) {
      setError(messageFor(problem, { 401: "That email and password don't match an account." }));
      setPassword("");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="access__title">Welcome back</h2>
      <fieldset disabled={pending}>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input id="login-email" className="input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <PasswordInput id="login-password" autoComplete="current-password" value={password} onChange={setPassword} />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="button button--primary access__submit">{pending ? "Logging in..." : "Log in"}</button>
        </div>
        <p className="field__hint access__forgot">Forgot your password? Password reset by email isn't switched on yet.</p>
      </fieldset>
    </form>
  );
}

function RegisterForm({ onDone, onUseLogin }) {
  const { register, login } = useAuth();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [problems, setProblems] = useState({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  function update(name, value) {
    setForm((previous) => ({ ...previous, [name]: value }));
    setProblems((previous) => ({ ...previous, [name]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    const fields = { ...form, username: form.username.trim(), email: form.email.trim() };
    const found = checkRegistration(fields);
    setProblems(found);
    if (Object.keys(found).length) return;

    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      await register({ username: fields.username, email: fields.email, password: fields.password });
      // The server never says whether an email was already taken, so try
      // signing in with what was just typed.
      try {
        await login({ email: fields.email, password: fields.password });
        onDone();
      } catch (signInProblem) {
        setError(
          signInProblem.status === 429
            ? "Too many sign-in attempts from this network. Wait a few minutes, then log in."
            : "Your request went through, but you couldn't be signed in automatically. If this email already has an account, log in with it instead.",
        );
      }
    } catch (problem) {
      setError(messageFor(problem, { 409: "That username isn't available. Try another one." }));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const describe = (name, hintId) => [hintId, problems[name] ? `register-${name}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="access__title">Create an account</h2>
      <fieldset disabled={pending}>
        <div className="field">
          <label htmlFor="register-username">Username</label>
          <input id="register-username" className="input" autoComplete="username" value={form.username} onChange={(event) => update("username", event.target.value)} aria-invalid={Boolean(problems.username)} aria-describedby={describe("username", "register-username-hint")} />
          <p id="register-username-hint" className="field__hint">3 to 35 letters or numbers. You can also use _ - and .</p>
          {problems.username && <p id="register-username-error" className="field__error">{problems.username}</p>}
        </div>
        <div className="field">
          <label htmlFor="register-email">Email</label>
          <input id="register-email" className="input" type="email" autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} aria-invalid={Boolean(problems.email)} aria-describedby={describe("email")} />
          {problems.email && <p id="register-email-error" className="field__error">{problems.email}</p>}
        </div>
        <div className="field">
          <label htmlFor="register-password">Password</label>
          <PasswordInput id="register-password" autoComplete="new-password" value={form.password} onChange={(value) => update("password", value)} invalid={Boolean(problems.password)} describedBy={describe("password", "register-password-hint")} />
          <p id="register-password-hint" className="field__hint">At least 15 characters. A short sentence you'll remember works well.</p>
          {problems.password && <p id="register-password-error" className="field__error">{problems.password}</p>}
        </div>
        <div className="field">
          <label htmlFor="register-confirm">Type the password again</label>
          <PasswordInput id="register-confirm" autoComplete="new-password" value={form.confirm} onChange={(value) => update("confirm", value)} invalid={Boolean(problems.confirm)} describedBy={describe("confirm")} />
          {problems.confirm && <p id="register-confirm-error" className="field__error">{problems.confirm}</p>}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}{" "}
            {error.includes("log in") && <button type="button" className="text-button" onClick={onUseLogin}>Go to Log in</button>}
          </p>
        )}
        <div className="form-actions">
          <button type="submit" className="button button--primary access__submit">{pending ? "Creating account..." : "Create account"}</button>
        </div>
      </fieldset>
    </form>
  );
}

// Password box with a Show/Hide button (handy for 15+ character passwords).
export function PasswordInput({ id, value, onChange, autoComplete, invalid = false, describedBy }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password">
      <input
        id={id}
        className="input"
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
      <button type="button" className="password__toggle" onClick={() => setVisible((shown) => !shown)} aria-pressed={visible} aria-label={visible ? "Hide password" : "Show password"}>
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
