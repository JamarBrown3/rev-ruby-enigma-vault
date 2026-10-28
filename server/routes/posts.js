import express from "express";
import PostsController from "../controllers/posts.js";

export default function postsRoutes(auth) {
  const router = express.Router();

  // get all Post route every can get all Posts
  // GET /api/posts?page=1 (anyone can get all posts)
  router.get("/", PostsController.getPosts);

  // get a specific route and show the id of the route
  // everyone can get a specific Post by id
  // GET /api/posts/:id (anyone can get a specific post by id)
  router.get("/:id", PostsController.getPost);

  // create a Post
  // POST /api/posts (authenticated users can create a post)
  router.post("/", auth.requireAuth, PostsController.createPost);

  // update a Post
  // PATCH /api/posts/:id (authenticated users can update a post)
  router.patch("/:id", auth.requireAuth, PostsController.updatePost);

  // Delete a Post
  // DELETE /api/posts/:id (authenticated users can delete a post)
  router.delete("/:id", auth.requireAuth, PostsController.deletePost);

  return router;
}
