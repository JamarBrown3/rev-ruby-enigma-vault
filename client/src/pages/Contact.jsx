// Contact (/contact): where "Let's Build Something" and "Start a conversation" go.
// It shows whichever links are filled in, in src/data/site.js (CONTACT).
// There's no form yet on purpose: a form needs a server route that sends the
// message (with rate limits and spam checks), which comes later.
import { Link } from "react-router-dom";
import { CONTACT } from "../data/site.js";
import usePageTitle from "../hooks/usePageTitle.js";

export default function Contact() {
  usePageTitle("Contact");
  const options = [
    CONTACT.email && { label: "Email", detail: CONTACT.email, href: `mailto:${CONTACT.email}?subject=Project%20for%20REV` },
    CONTACT.linkedin && { label: "LinkedIn", detail: "Message me on LinkedIn", href: CONTACT.linkedin },
    CONTACT.github && { label: "GitHub", detail: "See my code", href: CONTACT.github },
  ].filter(Boolean);

  return (
    <div className="page page--narrow">
      <header className="page-head">
        <h1>Let's build something.</h1>
        <p>Tell me what you're building, who it's for and when you need it. You'll hear back from the person who builds it.</p>
      </header>

      {options.length > 0 ? (
        <ul className="tools contact-options">
          {options.map((option) => (
            <li key={option.label}>
              <a className="tool" href={option.href} target={option.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                <span className="tool__name">{option.label}</span>
                <span className="tool__text">{option.detail}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="panel">
          <p className="status__title">Contact details are coming soon.</p>
          <p className="field__hint">Until then, see what I offer on the Services page.</p>
          <div className="form-actions">
            <Link className="button" to="/services">See services</Link>
          </div>
        </div>
      )}
    </div>
  );
}
