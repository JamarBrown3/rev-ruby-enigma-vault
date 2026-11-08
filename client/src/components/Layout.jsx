// The frame every page sits in: header, the two character reels, the page
// itself (<Outlet />), and the footer. The reels are here, not on each page,
// so they show on every page, including login.
import { useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import CharacterReels from "./CharacterReels.jsx";
import MobileNav from "./MobileNav.jsx";

export default function Layout() {
  const { pathname, hash } = useLocation();
  const { sessionEnded, dismissSessionEnded } = useAuth();

  const firstLoad = useRef(true);

  // A new page starts at the top (unless the link points at a #section).
  // After a page change (not the first load), move focus to the new page's main
  // heading so screen readers start reading there instead of in the old menu.
  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const heading = document.querySelector("#main h1");
    const target = heading || document.getElementById("main");
    if (heading && !heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    target?.focus({ preventScroll: true });
  }, [pathname, hash]);

  return (
    <div className="site" id="top">
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <CharacterReels />
      <main id="main" className="site-main" tabIndex={-1}>
        {sessionEnded && (
          <div className="session-banner" role="status">
            <p>Your session ended, so you've been signed out.</p>
            <div className="session-banner__actions">
              {pathname !== "/login" && (
                <Link className="button button--small button--primary" to="/login" state={{ from: pathname }}>Log in again</Link>
              )}
              <button type="button" className="button button--small" onClick={dismissSessionEnded}>Dismiss</button>
            </div>
          </div>
        )}
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
}
