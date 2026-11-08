import express from "express";
import CommentsController from "../controllers/comments.js";

// Mounted at /api/posts/:postId/comments in server.js.
// mergeParams: true lets these routes reead :postId from that path.

export default function commentsRoutes(auth) {
  const router = express.Router({ mergeParams: true });

  // GET /api/posts/:postId/comments (anyone can read comments)
  router.get("/", CommentsController.getComments);

  // POST /api/posts/:postId/comments (only logged-in users can post comments)
  router.post("/", auth.requireAuth, CommentsController.createComment);

  // DELETE /api/posts/:postId/comments/:commentId (only the comment's author can delete it)
  router.delete(
    "/:commentId",
    auth.requireAuth,
    CommentsController.deleteComment,
  );

  // PATCH /api/posts/:postId/comments/:commentId (only the comment's author can edit it)
  router.patch(
    "/:commentId",
    auth.requireAuth,
    CommentsController.updateComment,
  );

  return router;
}
