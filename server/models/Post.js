// Post for each user and a user can have many posts
// one to many relationship between user and post

import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    // Reference to the User model-not the filename.
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Reviews require a game; discussions do not.
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Game",
      required: function () {
        return this.kind === "review";
      },
    },

    // The kind of post, either "review" or "discussion".
    kind: {
      type: String,
      enum: ["review", "discussion"],
      default: "discussion",
      required: true,
    },

    // The title of the post, required for both reviews and discussions.
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 400,
    },

    // The body of the post, required for both reviews and discussions.
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },

    // The image URL of the post, optional.
    imageUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    // Rating is required for reviews and not allowed for discussions.
    rating: {
      type: Number,
      min: 1,
      max: 10,
      required: function () {
        return this.kind === "review";
      },
    },
    // Recommendation is optional for reviews; there is no default value.
    recommend: {
      type: Boolean,
    },
  },
  {
    timestamps: true,
    collection: "posts",
  },
);

// Cross-field rule: disucssions should not contain review-only fields.
// This runs during document validation, including before save().
postSchema.pre("validate", function () {
  if (this.kind === "discussion") {
    if (this.rating !== undefined) {
      this.invalidate("rating", "Ratings belong to review posts only.");
    }

    if (this.recommend !== undefined) {
      this.invalidate(
        "recommend",
        "Recommendations belong to review posts only.",
      );
    }
  } // Both checks belong inside this condition.
});

// Supports displaying the newest posts first.
// _id provides a consistent tie-breaker for identical timestamps.
postSchema.index({ createdAt: -1, _id: -1 });

const Post = mongoose.model("Post", postSchema);
export default Post;
