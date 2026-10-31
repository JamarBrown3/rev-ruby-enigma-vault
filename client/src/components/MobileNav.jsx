// Phone tab bar (the "Tab Bar" style from the menu-styles sheet): fixed to the
// bottom of the screen, icon + label, ruby for the page you're on.
// CSS shows it only on screens narrower than 768px (see .tab-bar in layout.css);
// the header's Menu button still lists every page.
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { GamepadIcon, HomeIcon, InfoIcon, UserIcon } from "./Icons.jsx";

export default function MobileNav() {
  const { user } = useAuth();

  // Add, remove or reorder tabs here (4 or 5 fit best).
  const tabs = [
    { to: "/", label: "Home", Icon: HomeIcon, end: true },
    { to: "/games", label: "Games", Icon: GamepadIcon },
    { to: "/about", label: "About", Icon: InfoIcon },
    // Visitors get "Log in" in the same spot; members get their profile.
    user ? { to: "/profile", label: "Profile", Icon: UserIcon } : { to: "/login", label: "Log in", Icon: UserIcon },
  ];

  return (
    <nav className="tab-bar" aria-label="Quick links">
      {tabs.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="tab-bar__link">
          <span className="tab-bar__icon">
            <Icon width={22} height={22} />
          </span>
          <span className="tab-bar__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
