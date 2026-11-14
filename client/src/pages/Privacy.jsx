// Privacy (/privacy): what REV stores, what it doesn't, and how to delete an account.

// Plain English on purpose. If the server starts storing something new, update this page.

import { Link } from "react-router-dom";
import usePageTitle from "../hooks/usePageTitle.js";

export default function Privacy() {
  usePageTitle("Privacy");
  return (
    <div className="page page--narrow privacy">
      <header className="page-head">
        <h1>Privacy</h1>
        <p>
          What REV keeps about you, what it never does, and how to have your
          account deleted.
        </p>
      </header>

      <section className="privacy__section" aria-labelledby="privacy-stores">
        <h2 id="privacy-stores">What REV stores</h2>
        <h3>Your account</h3>
        <ul className="privacy__list">
          <li>
            Your email address and username. Past usernames are kept so people
            can't pretend to be someone else.
          </li>
          <li>
            Your password, but never as the password itself. It's turned into an
            Argon2id hash, a one-way scramble that can't be turned back into
            your original password. The hash is stored in the database, and is
            used to check your password when you sign in.
          </li>
        </ul>

        <h3>What you post</h3>
        <ul className="privacy__list">
          <li>Your posts and comments.</li>
          <li>
            Your likes and dislikes, so each person gets one vote per post.
          </li>
        </ul>
        <h3>When you sign in</h3>
        <ul className="privacy__list">
          <li>
            A short-lived count of sign-in attempts, saved as a scrambled code
            instead of your email, to stop password brute-force attacks or
            guessing.
          </li>
          <li>
            One session cookie that keeps you signed in. Page scripts can't read
            it, and it ends after 30 minutes without activity or when you sign
            out.
          </li>
          <li>
            A security token, called a CSRF token, that proves a form was sent
            from REV and not from another site.
          </li>
        </ul>
        <h3>In your browser only</h3>
        <ul className="privacy__list">
          <li>
            Your light or dark theme, and whether you paused the character
            reels. These are saved in your browser's local storage, never sent
            to REV, and you can clear them anytime.
          </li>
        </ul>
      </section>

      <section className="privacy__section" aria-labelledby="privacy-never">
        <h2 id="privacy-never">What REV never does</h2>
        <ul className="privacy__list">
          <li>No ads.</li>
          <li>
            No analytics or tracking scripts. REV's fonts and images come from
            REV itself, not from other companies.
          </li>
          <li>
            No selling your data. The only outside companies that handle it are
            the ones that host REV and its database.
          </li>
        </ul>
      </section>

      <section className="privacy__section" aria-labelledby="privacy-google">
        <h2 id="privacy-google">Google forms and booking</h2>
        <p>
          The inquiry form and the call booking on the{" "}
          <Link to="/contact">Contact page</Link> are run by Google, not REV. What
          you enter there follows{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noreferrer"
          >
            Google's privacy policy
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
          .
        </p>
      </section>

      <section className="privacy__section" aria-labelledby="privacy-delete">
        <h2 id="privacy-delete">Deleting your account</h2>
        <p>
          Send a request through the <Link to="/contact">Contact page</Link>{" "}
          with your username and the email on your account. I'll confirm
          it's really you, then delete your account along with your posts,
          comments and votes, and let you know when it's done.
        </p>
      </section>
      <p className="privacy__updated">Last updated November 13, 2026.</p>
    </div>
  );
}
