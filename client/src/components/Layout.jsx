// The frame every page sits in: header, the two character reels, the page
// itself (<Outlet />), and the footer. The reels are here, not on each page,
// so they show on every page, including login.
import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import CharacterReels from "./CharacterReels.jsx";
import MobileNav from "./MobileNav.jsx";

export default function Layout() {
  const { pathname, hash } = useLocation();
  const { sessionEnded, dismissSessionEnded } = useAuth();

  // A new page starts at the top (unless the link points at a #section).
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
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
