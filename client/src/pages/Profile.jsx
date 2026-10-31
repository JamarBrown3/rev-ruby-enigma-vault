// Your profile (/profile): where the phone tab bar's Profile button goes.
// For now it's shortcuts and settings; post history and account settings come
// with the profile routes on the server.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import usePageTitle from "../hooks/usePageTitle.js";

export default function Profile() {
  usePageTitle("Your profile");
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  async function handleLogout() {
    setError("");
    try {
      await logout();
      navigate("/");
    } catch {
      setError("Couldn't log out. Try again.");
    }
  }

  const shortcuts = [
    { to: "/posts/new", name: "Write a post", text: "Start a discussion or review a game." },
    { to: "/dashboard", name: "Sample dashboard", text: "See how a client dashboard explains its numbers." },
    ...(isAdmin ? [{ to: "/admin/dashboard", name: "Admin dashboard", text: "Community numbers, newest posts and admin tools." }] : []),
  ];

  return (
    <div className="page page--narrow">
      <header className="profile-head">
        <span className="profile-avatar" aria-hidden="true">{user.username.charAt(0).toUpperCase()}</span>
        <div>
          <h1 className="profile-head__name">{user.username}</h1>
          <p className="profile-head__role">{isAdmin ? "Admin: you run the vault." : "Member: you can write posts and reviews."}</p>
        </div>
      </header>

      <section aria-labelledby="shortcuts-title">
        <h2 id="shortcuts-title" className="visually-hidden">Shortcuts</h2>
        <ul className="tools profile-shortcuts">
          {shortcuts.map((item) => (
            <li key={item.to}>
              <Link className="tool" to={item.to}>
                <span className="tool__name">{item.name}</span>
                <span className="tool__text">{item.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="section panel profile-settings" aria-labelledby="settings-title">
        <h2 id="settings-title" className="profile-settings__title">Settings</h2>
        <div className="profile-settings__row">
          <div>
            <p className="profile-settings__label">Appearance</p>
            <p className="field__hint">Dark is the default. Your choice is saved in this browser.</p>
          </div>
          <ThemeToggle withLabel />
        </div>
        <div className="profile-settings__row">
          <div>
            <p className="profile-settings__label">Sign out</p>
            <p className="field__hint">Ends your session on this device.</p>
          </div>
          <button type="button" className="button button--danger" onClick={handleLogout}>Log out</button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="field__hint">Your post history and account settings will show up here once the profile routes are built.</p>
      </section>
    </div>
  );
}
