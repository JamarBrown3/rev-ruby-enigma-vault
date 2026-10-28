import mongoose from "mongoose";
// REV-SEC-14: database-wide safety settings; must load before the schema below.
import "../config/mongooseSecurity.js";
// REV-SEC-17: only https:// links or the site's own /asset paths may be stored.
import { safeUrl } from "./validators.js";

const gameSchema = new mongoose.Schema(
  {
    // Human-readable title of the game, required and unique.
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    // consistent identifier, such as "the-legend-of-zelda" or "call-of-duty", required and unique.
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },

    // consistent identifier, such as "the-legend-of-zelda" or "call-of-duty", required and unique.
    platform: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // consistent identifier, such as "the-legend-of-zelda" or "call-of-duty", required and unique.
    genre: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // consistent identifier, such as "the-legend-of-zelda" or "call-of-duty", required and unique.
    releaseYear: {
      type: Number,
      min: 1950,
      max: 2100,
      validate: {
        validator: Number.isInteger,
        message: `Release year must be a whole number`,
      },
    },

    // consistent identifier, such as "the-legend-of-zelda" or "call-of-duty", required and unique.
    coverImage: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
      // REV-SEC-17: https:// address or a site path such as /images/cover.png.
      validate: safeUrl({ allowRelative: true }),
    },

    // consistent identifier, such as "the-legend-of-zelda" or "call-of-duty", required and unique.
    headerImage: {
      type: String,
      trim: true,
      maxlength: 2000,
      // REV-SEC-17: https:// address or a site path such as /images/header.png.
      validate: safeUrl({ allowRelative: true }),
    },

    // One game can reference multiple Category documents.
    categoryIds: {
      // Array of ObjectIds referencing Category documents, with a maximum of 10 unique categories.
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
        },
      ],
      default: [],
      validate: {
        validator: function (ids) {
          const uniqueIds = new Set(ids.map((id) => id.toString()));

          return ids.length <= 10 && uniqueIds.size === ids.length;
        },
        message: "Choose up to 10 categories without duplicates.",
      },
    },

    // Initially represents your own recorded playtime.
    playtimeHours: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "games",
  },
);

const Game = mongoose.model("Game", gameSchema);

export default Game;
