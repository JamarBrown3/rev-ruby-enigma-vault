import mongoose from "mongoose";
// REV-SEC-14: database-wide safety settings; must load before the schema below.
import "../config/mongooseSecurity.js";

const categorySchema = new mongoose.Schema(
  {
    // Human-readable name of the category, required and unique.
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // consistent identifier, such as "role-playing" or "first-person-shooter", required and unique.
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, // Slug format validation
      unique: true,
    },
  },
  {
    timestamps: true,
    collection: "categories",
  },
);

// Case-insentive unique index on the name field to ensure no duplicate category names exist, regardless of case.
categorySchema.index(
  { name: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
  },
);

const Category = mongoose.model("Category", categorySchema);

export default Category;
