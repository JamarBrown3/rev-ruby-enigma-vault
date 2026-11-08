import express from "express";
import AdminUsersController from "../controllers/adminUsers.js";

// REV-SEC-27 (added 2026-11-07): admin-only routes, mounted at /api/admin.
// app.js already puts requireAdmin and the CSRF check in front of /api/admin;
// requireAdmin is repeated here so this router stays safe even if it's ever
// mounted somewhere else by mistake.
export default function adminRoutes(auth) {
  const router = express.Router();

  // Force-rename a member: { "username": "new_name", "reason": "optional note" }
  router.patch("/users/:id/username", auth.requireAdmin, AdminUsersController.renameUser);

  return router;
}
