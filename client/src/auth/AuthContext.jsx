// Who is signed in, shared with every page.
// The server is the real gatekeeper (sessions + requireAuth/requireAdmin); this
// only decides what to SHOW. Nothing secret is kept in the browser: no password,
// no session ID, nothing in localStorage. The session cookie is httpOnly, so
// JavaScript can't read it at all.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import authApi from "../services/authApi.js";
import { SIGNED_OUT_EVENT } from "../services/request.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, username, role } or null
  const [checking, setChecking] = useState(true); // true until /me answers
  const [sessionEnded, setSessionEnded] = useState(false); // shows the "signed out" banner
  const userRef = useRef(null); // the latest user, for the listener below
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // On first load, ask the server whether this browser already has a session.
  useEffect(() => {
    let ignore = false;
    authApi
      .me()
      .then((found) => {
        if (!ignore) setUser(found);
      })
      .catch(() => {
        if (!ignore) setUser(null);
      })
      .finally(() => {
        if (!ignore) setChecking(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // A request found the session had ended: show the visitor view again.
  useEffect(() => {
    const forget = () => {
      if (userRef.current) setSessionEnded(true);
      setUser(null);
    };
    window.addEventListener(SIGNED_OUT_EVENT, forget);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, forget);
  }, []);

  async function login(fields) {
    const signedIn = await authApi.login(fields);
    setUser(signedIn);
    setSessionEnded(false);
    return signedIn;
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
  }

  const value = {
    user,
    checking,
    isAdmin: user?.role === "admin",
    login,
    logout,
    register: authApi.register,
    sessionEnded,
    dismissSessionEnded: () => setSessionEnded(false),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
