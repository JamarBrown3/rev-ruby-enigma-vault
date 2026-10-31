// Shared header: logo, the main links (each with the small sub-label from the
// wireframe), and what you can do as a visitor, member or admin.
import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import Logo from "./Logo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import AdminSideMenu from "./AdminSideMenu.jsx";
import { CloseIcon, MenuIcon } from "./Icons.jsx";

const MAIN_LINKS = [
  { to: "/", label: "Home", sub: "Community posts", end: true },
  { to: "/games", label: "Games", sub: "The library" },
  { to: "/about", label: "About", sub: "Meet the creator" },
  { to: "/services", label: "Services", sub: "What I build" },
];

export default function Header() {
  const { user, isAdmin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const closeAdminMenu = useCallback(() => setAdminMenuOpen(false), []);

  // The admin hamburger only appears on the admin pages (not the sign-in page).
  const onAdminPage = isAdmin && location.pathname.startsWith("/admin/") && location.pathname !== "/admin/login";

  // Close both menus whenever the page changes.
  useEffect(() => {
    setMenuOpen(false);
    setAdminMenuOpen(false);
  }, [location.pathname]);

  // Escape closes the phone menu too.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Links that depend on who is signed in.
  const accountLinks = [];
  if (!user) accountLinks.push({ to: "/login", label: "Log in", sub: "Join the vault" });
  if (user) accountLinks.push({ to: "/dashboard", label: "Dashboard", sub: "Sample insights" });
  if (isAdmin) accountLinks.push({ to: "/admin/dashboard", label: "Admin", sub: "Control room" });

  async function handleLogout() {
    setLogoutError("");
    try {
      await logout();
      navigate("/");
    } catch {
      setLogoutError("Couldn't log out. Try again.");
    }
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="site-header__start">
          {onAdminPage && (
            <button
              type="button"
              className="icon-button admin-menu-toggle"
              aria-label="Open admin menu"
              aria-expanded={adminMenuOpen}
              aria-controls="admin-side-menu"
              title="Admin menu"
              onClick={() => setAdminMenuOpen(true)}
            >
              <MenuIcon />
            </button>
          )}
          <Link to="/" className="brand">
            <Logo />
            <span className="brand__text">
              <span className="brand__name">REV</span>
              <span className="brand__tagline">The Ruby Enigma Vault</span>
            </span>
          </Link>
        </div>

        <button
          type="button"
          className="icon-button menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="site-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
          <span>Menu</span>
        </button>

        <nav id="site-nav" className={`site-nav${menuOpen ? " is-open" : ""}`} aria-label="Main">
          <ul className="site-nav__links">
            {[...MAIN_LINKS, ...accountLinks].map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} end={link.end} className="nav-link">
                  <span className="nav-link__label">{link.label}</span>
                  <span className="nav-link__sub">{link.sub}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="site-nav__tools">
            {user && (
              <div className="account">
                <span className="account__name" title={`Signed in as ${user.username}`}>
                  {user.username}
                </span>
                <button type="button" className="text-button" onClick={handleLogout}>
                  Log out
                </button>
                {logoutError && <span className="account__error" role="alert">{logoutError}</span>}
              </div>
            )}
            <ThemeToggle />
          </div>
        </nav>
      </div>
      {onAdminPage && <AdminSideMenu open={adminMenuOpen} onClose={closeAdminMenu} />}
    </header>
  );
}
