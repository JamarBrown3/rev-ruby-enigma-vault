import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <p className="site-footer__brand">REV</p>
          <p className="site-footer__note">The Ruby Enigma Vault, built by Jamar (Jah) Brown.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="site-footer__links">
            <li><Link to="/">Community posts</Link></li>
            <li><Link to="/games">Game library</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/services">Services</Link></li>
            <li><Link to="/contact">Contact</Link></li>
          </ul>
        </nav>
        <a className="site-footer__top" href="#top">Back to top</a>
      </div>
      <p className="site-footer__legal">© {new Date().getFullYear()} Jamar Brown</p>
    </footer>
  );
}
