import mongoose from "mongoose";

// The Comment model represents a comment made by a user on a post. Each comment is associated with a specific post and has an author. The body of the comment is required and can be up to 10,000 characters long. Comments are timestamped and stored in the "comments" collection.
const commentSchema = new mongoose.Schema(
  {
    // Reference to the Post model, indicating which post the comment belongs to.
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    // Reference to the User model, indicating who authored the comment.
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The body of the comment, which is required and can be up to 10,000 characters long.
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },
  },
  {
    // Timestamps and collection name for the schema.
    timestamps: true,
    collection: "comments",
  },
);

// Supports displaying the oldest comments first. _id provides a consistent tie-breaker for identical timestamps.
commentSchema.index({
  postId: 1,
  createdAt: 1,
  _id: 1,
});

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
