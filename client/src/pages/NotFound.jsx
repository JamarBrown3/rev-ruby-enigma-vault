import { Link } from "react-router-dom";
import usePageTitle from "../hooks/usePageTitle.js";

export default function NotFound() {
  usePageTitle("Page not found");
  return (
    <div className="page page--narrow not-found">
      <p className="not-found__code" aria-hidden="true">404</p>
      <h1>This part of the vault is empty.</h1>
      <p>The page doesn't exist or has moved.</p>
      <div className="form-actions">
        <Link className="button button--primary" to="/">Go to community posts</Link>
        <Link className="button" to="/games">Browse games</Link>
      </div>
    </div>
  );
}
