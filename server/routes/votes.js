import express from "express";
import VotesController from "../controllers/votes.js";

// Mounted at /api/posts/:postId/votes in server.js.
// mergeParams: true lets these routes read :postId from that path.
export default function voteRoutes(auth) {
  const router = express.Router({ mergeParams: true });

  // GET /api/posts/:postId/votes (anyone: just like/dislike total)
  router.get("/", VotesController.getVotes);

  // GET /api/posts/:postId/votes/me (signed in: totals + which button you pressed)
  router.get("/me", auth.requireAuth, VotesController.getMyVote);

  // PUT /api/posts/:postId/votes (signed in: set your vote to 1 or -1)
  router.put("/", auth.requireAuth, VotesController.setVote);

  // DELETE /api/posts/:postId/votes (signed in: remove your vote)
  router.delete("/", auth.requireAuth, VotesController.removeVote);

  return router;
}
