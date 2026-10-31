// Admin side menu (the "Side Menu" style from the menu-styles sheet).
// Opened by the hamburger at the left of the header on /admin pages.
// It slides in from the left over a dimmed backdrop.
//
// Behaves like a dialog so it's usable without a mouse:
//   - focus moves into the menu when it opens and back to the hamburger after
//   - Tab stays inside the menu while it's open
//   - Escape, the X button, or clicking the backdrop closes it
//   - the page behind can't scroll while it's open
// createPortal puts it at the end of <body>, so it sits above everything
// (header, reels and the phone tab bar).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import Logo from "./Logo.jsx";
import {
  ChartIcon,
  CloseIcon,
  ExitIcon,
  FlagIcon,
  GamepadIcon,
  GridIcon,
  ListIcon,
  PlusIcon,
  UsersIcon,
  WrenchIcon,
} from "./Icons.jsx";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function AdminSideMenu({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [logoutError, setLogoutError] = useState("");

  // Keep the latest onClose in a ref, so the effect below only re-runs when the
  // menu opens or closes (not every time the header re-renders).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement; // the hamburger, to return focus to
    const panel = panelRef.current;
    panel?.querySelector(FOCUSABLE)?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      // Keep Tab inside the menu: past the last item goes back to the first.
      const items = [...panel.querySelectorAll(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [open]);

  async function handleLogout() {
    setLogoutError("");
    try {
      await logout();
      onClose();
      navigate("/");
    } catch {
      setLogoutError("Couldn't log out. Try again.");
    }
  }

  const linkClass = ({ isActive }) => `side-menu__link${isActive ? " is-current" : ""}`;

  return createPortal(
    <div className={`side-menu${open ? " is-open" : ""}`} aria-hidden={!open} inert={!open}>
      <div className="side-menu__backdrop" onClick={onClose} />

      <div
        ref={panelRef}
        id="admin-side-menu"
        className="side-menu__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="side-menu-title"
      >
        <div className="side-menu__head">
          <div className="side-menu__brand">
            <Logo size={34} />
            <div>
              <p id="side-menu-title" className="side-menu__title">Control room</p>
              <p className="side-menu__who">Signed in as {user?.username}</p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close admin menu">
            <CloseIcon />
          </button>
        </div>

        <nav className="side-menu__nav" aria-label="Admin">
          <p className="side-menu__group">Dashboard</p>
          <NavLink to="/admin/dashboard" end className={linkClass} onClick={onClose}>
            <GridIcon /> Overview
          </NavLink>
          <Link to="/admin/dashboard#live-posts" className="side-menu__link" onClick={onClose}>
            <ListIcon /> Newest posts
          </Link>
          <NavLink to="/dashboard" className={linkClass} onClick={onClose}>
            <ChartIcon /> Sample client dashboard
          </NavLink>

          <p className="side-menu__group">Game library</p>
          <NavLink to="/admin/games/new" className={linkClass} onClick={onClose}>
            <PlusIcon /> Add a game
          </NavLink>
          <NavLink to="/games" className={linkClass} onClick={onClose}>
            <GamepadIcon /> Manage games
          </NavLink>

          <p className="side-menu__group">Coming with the admin routes</p>
          <span className="side-menu__link is-soon" aria-disabled="true">
            <FlagIcon /> Reports <span className="side-menu__soon">Soon</span>
          </span>
          <span className="side-menu__link is-soon" aria-disabled="true">
            <UsersIcon /> Members and bans <span className="side-menu__soon">Soon</span>
          </span>

          {import.meta.env.DEV && (
            <>
              <p className="side-menu__group">Developer</p>
              <Link to="/dev/routes" className="side-menu__link" onClick={onClose}>
                <WrenchIcon /> Route tester
              </Link>
            </>
          )}
        </nav>

        <div className="side-menu__foot">
          <Link to="/" className="side-menu__link" onClick={onClose}>
            <ExitIcon /> Back to the site
          </Link>
          <button type="button" className="button button--small" onClick={handleLogout}>
            Log out
          </button>
          {logoutError && <p className="field__error" role="alert">{logoutError}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
