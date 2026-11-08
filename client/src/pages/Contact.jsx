// Contact (/contact): where "Let's Build Something" and "Start a conversation" go.
// Links come from CONTACT in src/data/site.js; empty ones are hidden.
// The project form lives on Calendly (or a Google / Microsoft form), so REV
// doesn't need a server route, spam checks or an email service for it.
import { Link } from "react-router-dom";
import { CONTACT } from "../data/site.js";
import usePageTitle from "../hooks/usePageTitle.js";

export default function Contact() {
  usePageTitle("Contact");
  const others = [
    CONTACT.linkedin && { label: "LinkedIn", detail: "Connect or send me a message", href: CONTACT.linkedin },
    CONTACT.github && { label: "GitHub", detail: "See my code", href: CONTACT.github },
  ].filter(Boolean);

  return (
    <div className="page page--narrow">
      <header className="page-head">
        <h1>Let's build something.</h1>
        <p>Tell me what you're building, who it's for and when you need it. You'll hear back from the person who builds it.</p>
      </header>

      {CONTACT.projectForm ? (
        <section className="panel contact-start" aria-labelledby="contact-start-title">
          <h2 id="contact-start-title" className="contact-start__title">Start a project</h2>
          <p>Answer a few questions about your business and pick a time for a free 20-minute call.</p>
          <div className="form-actions">
            <a className="button button--primary" href={CONTACT.projectForm} target="_blank" rel="noreferrer">
              Book a project call<span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          </div>
        </section>
      ) : (
        <div className="panel">
          <p className="status__title">Project bookings open soon.</p>
          <p className="field__hint">Until then, see what I offer on the Services page.</p>
          <div className="form-actions">
            <Link className="button" to="/services">See services</Link>
          </div>
        </div>
      )}

      {others.length > 0 && (
        <section className="section" aria-labelledby="contact-other-title">
          <h2 id="contact-other-title">Other places to find me</h2>
          <ul className="tools contact-options">
            {others.map((option) => (
              <li key={option.label}>
                <a className="tool" href={option.href} target="_blank" rel="noreferrer">
                  <span className="tool__name">{option.label}<span className="visually-hidden"> (opens in a new tab)</span></span>
                  <span className="tool__text">{option.detail}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
