import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// Fonts are installed with npm (no Google request) and both use the SIL Open
// Font License, so they're fine on a commercial site.
//   Gloock: the engraved-looking serif for big headings.
//   Schibsted Grotesk: everything else.
import "@fontsource/gloock/400.css";
import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/500.css";
import "@fontsource/schibsted-grotesk/700.css";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/pages.css";
import "./styles/dashboard.css";

import { AuthProvider } from "./auth/AuthContext.jsx";
import { applySavedTheme } from "./theme.js";
import App from "./App.jsx";

applySavedTheme(); // before the first paint, so there's no flash of the wrong theme

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
