// About (/about): who Jah is, what he builds, and how to hire him.
// Photos and the "Curiosity is the common thread" line come from my
// Jamar-Brown-Portfolio About section, restyled for REV (dark + ruby).
// Skills, projects and contact links are edited in src/data/site.js.
// Styles: About.css (written phone-first: one column, then two on wider screens).
import { Link } from "react-router-dom";
import { PROJECTS, SKILLS } from "../data/site.js";
import usePageTitle from "../hooks/usePageTitle.js";
import "./About.css";

export default function About() {
  usePageTitle("About");

  return (
    <div className="page about">
      {/* Hero: who I am in one line, with the main photo */}
      <section className="about-hero" aria-labelledby="about-title">
        <div className="about-hero__copy">
          <h1 id="about-title" className="about-hero__title">Full-stack developer and data analyst.</h1>
          <p className="about-hero__lead">
            I'm Jamar Brown, Jah for short. I build web applications from the database to the screen, then turn the
            numbers they collect into dashboards anyone can read.
          </p>
          <div className="about-hero__actions">
            <Link className="button button--primary" to="/contact">Let's Build Something</Link>
            <a className="button" href="#work">See what I've built</a>
          </div>
        </div>
        <figure className="about-hero__photo">
          <img
            src="/images/about/jamar-portrait.webp"
            width="720"
            height="1080"
            alt="Jamar Brown smiling with his arms folded"
            fetchPriority="high"
          />
        </figure>
      </section>

      {/* Bio: background, current focus, and the company-of-one mission */}
      <section className="about-bio" aria-labelledby="bio-title">
        <figure className="about-bio__photo">
          <img
            src="/images/about/jamar-about.webp"
            width="600"
            height="900"
            alt="Jamar Brown smiling with a hand resting under his chin"
            loading="lazy"
          />
        </figure>
        <div className="about-bio__copy">
          <h2 id="bio-title">Curiosity is the common thread.</h2>
          <div className="about-bio__part">
            <h3>Background</h3>
            <p>
              I study Computer Information Systems at the Borough of Manhattan Community College (BMCC). I've built
              full-stack apps with React, Express, PostgreSQL and MongoDB, and I analyze data with Python, R, SQL and
              Tableau.
            </p>
          </div>
          <div className="about-bio__part">
            <h3>What I'm building now</h3>
            <p>
              Custom web applications and data dashboards for small businesses: sites that are fast and secure, and
              dashboards that turn sales and customer numbers into a few plain-English sentences each day. REV is the
              working example.
            </p>
          </div>
          <div className="about-bio__part about-bio__mission">
            <h3>A company of one</h3>
            <p>
              I follow the company-of-one idea: grow by doing better work, not by getting bigger. You work directly
              with the person who builds your product, and the time goes into the parts that pay off for your
              business.
            </p>
          </div>
        </div>
      </section>

      {/* Skills grid */}
      <section className="about-section" aria-labelledby="skills-title">
        <h2 id="skills-title">My stack</h2>
        <p className="about-section__lead">The tools I use, from the server to the spreadsheet.</p>
        <ul className="skill-grid">
          {SKILLS.map((skill) => (
            <li key={skill.name} className="skill">
              <span className="skill__badge" aria-hidden="true">{skill.code}</span>
              <h3 className="skill__name">{skill.name}</h3>
              <p className="skill__use">{skill.use}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Projects */}
      <section className="about-section" id="work" aria-labelledby="projects-title">
        <h2 id="projects-title">Things I've built</h2>
        <ul className="projects">
          {PROJECTS.map((project) => (
            <li key={project.name} className="project">
              <div>
                <h3 className="project__name">{project.name}</h3>
                <p className="project__stack">{project.stack}</p>
              </div>
              <p className="project__about">{project.about}</p>
              {(project.url || project.code) && (
                <p className="project__links">
                  {project.url && <a href={project.url} target="_blank" rel="noreferrer">Live site</a>}
                  {project.code && <a href={project.code} target="_blank" rel="noreferrer">Code</a>}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Call to action */}
      <section className="about-cta" aria-labelledby="cta-title">
        <h2 id="cta-title">Have a website, store or dashboard in mind?</h2>
        <p>Tell me what you're building and when you need it.</p>
        <Link className="button button--primary about-cta__button" to="/contact">Let's Build Something</Link>
      </section>
    </div>
  );
}
