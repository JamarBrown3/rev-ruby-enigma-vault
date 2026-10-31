// Route guards. They only change what the browser shows: the API checks the
// session again on every request, so hiding a page is never the security.
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import NotFound from "../pages/NotFound.jsx";

// Signed-in members only. Visitors go to /login and come back here afterwards.
export function RequireAuth({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) return <StatusMessage kind="loading" title="Checking your session" />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

// The admin (Jah) only. Everyone else sees an ordinary 404, so the page
// doesn't advertise that an admin area exists.
export function RequireAdmin({ children }) {
  const { user, checking } = useAuth();

  if (checking) return <StatusMessage kind="loading" title="Checking your session" />;
  if (user?.role !== "admin") return <NotFound />;
  return children;
}

// Where to go after signing in. Only same-site paths are allowed ("/games"),
// never "//evil.example" or a full URL, and members are never sent to /admin.
export function safeReturnPath(from, fallback = "/") {
  if (typeof from !== "string") return fallback;
  if (!from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) return fallback;
  if (from.startsWith("/admin")) return fallback;
  return from;
}
