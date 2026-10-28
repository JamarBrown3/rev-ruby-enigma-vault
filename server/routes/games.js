import express from "express";
import GamesController from "../controllers/games.js";

export default function gameRoutes(auth) {
  const router = express.Router();

  // get all Game route every can get all games
  router.get("/", GamesController.getGames);

  // get a specific route and show the id of the route
  // everyone can get a specific game by id
  router.get("/:id", GamesController.getGame);

  // create a Game
  router.post("/", auth.requireAdmin, GamesController.createGame);

  // update a Game
  router.patch("/:id", auth.requireAdmin, GamesController.updateGame);

  // create a delete

  router.delete("/:id", auth.requireAdmin, GamesController.deleteGame);

  return router;
}
