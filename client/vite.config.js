import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The proxy sends every /api request from the React page (port 5173) to the
// Express server (port 3002). To the browser it all looks like ONE site, so the
// login cookie and CSRF token just work - no CORS setup needed.
// 127.0.0.1 (not "localhost"): the server only listens on 127.0.0.1 in development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:3002" },
    },
  },
  // `npm test` (Vitest): runs the *.test.jsx files in a fake browser (jsdom).
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
  },
});
