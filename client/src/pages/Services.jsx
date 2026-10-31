// What I build for clients.
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import usePageTitle from "../hooks/usePageTitle.js";

const SERVICES = [
  {
    name: "Websites",
    summary: "A fast site that works on every screen, for a portfolio, a community or a small business.",
    includes: ["Design and build", "Accounts with secure logins, if you need them", "Hosting set up and handed over"],
  },
  {
    name: "Storefronts",
    summary: "Shopify stores where products are easy to find and easy to buy.",
    includes: ["Catalog and product pages", "Checkout set up", "The pages around the store: about, contact, policies"],
    note: "Storefronts are next on my list. Ask if you'd like to be one of the first.",
  },
  {
    name: "Dashboards",
    summary: "Your sales and customer numbers on one page, with three plain-English sentences about what changed.",
    includes: ["Charts for the numbers you check most", "A short AI-written summary each day", "A printable report"],
  },
];

const STEPS = [
  { name: "Talk", text: "We go over what you sell, who visits, and what the site needs to do." },
  { name: "Plan", text: "You get a page list, a sketch of each page and a price before any code is written." },
  { name: "Build", text: "I build it and share a working preview so you can click through it early." },
  { name: "Launch", text: "The site goes live, and you get the logins and a walkthrough of how to update it." },
];

export default function Services() {
  usePageTitle("Services");
  const { user } = useAuth();

  return (
    <div className="page">
      <header className="page-head">
        <h1>Websites, storefronts and dashboards for small businesses.</h1>
        <p>I build the site, connect it to your data, and explain the numbers in plain English.</p>
      </header>

      <div className="services">
        {SERVICES.map((service) => (
          <section key={service.name} className="service" aria-labelledby={`service-${service.name}`}>
            <h2 id={`service-${service.name}`} className="service__name">{service.name}</h2>
            <p className="service__summary">{service.summary}</p>
            <ul className="service__list">
              {service.includes.map((item) => <li key={item}>{item}</li>)}
            </ul>
            {service.note && <p className="service__note">{service.note}</p>}
            {service.name === "Dashboards" && (
              <Link className="button" to="/dashboard">{user ? "Open the sample dashboard" : "Try the sample dashboard"}</Link>
            )}
          </section>
        ))}
      </div>

      <section className="section" aria-labelledby="steps-title">
        <h2 id="steps-title">How a project runs</h2>
        <ol className="steps">
          {STEPS.map((step) => (
            <li key={step.name} className="step">
              <h3>{step.name}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section cta-panel" aria-labelledby="cta-title">
        <div>
          <h2 id="cta-title">Have a project in mind?</h2>
          <p>Tell me what you're building and when you need it.</p>
        </div>
        <Link className="button button--primary" to="/contact">Start a conversation</Link>
      </section>
    </div>
  );
}
