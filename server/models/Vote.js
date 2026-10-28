import mongoose from "mongoose";
// REV-SEC-14: database-wide safety settings; must load before the schema below.
import "../config/mongooseSecurity.js";

const voteSchema = new mongoose.Schema(
  {
    // Reference to the Post model, indicating which post the vote belongs to.
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },

    // Reference to the User model, indicating who cast the vote.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The value of the vote, either 1 (upvote) or -1 (downvote).
    value: {
      type: Number,
      enum: [1, -1],
      required: true,
    },
  },
  {
    //  Timestamps and collection name for the schema.
    timestamps: true,
    collection: "votes",
  },
);

// The combination of postId and userId must be unique, ensuring that a user can only vote once per post.

voteSchema.index(
  {
    postId: 1,
    userId: 1,
  },
  { unique: true },
);

const Vote = mongoose.model("Vote", voteSchema);

export default Vote;
