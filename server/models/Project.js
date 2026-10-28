import mongoose from "mongoose";
// REV-SEC-14: database-wide safety settings; must load before the schema below.
import "../config/mongooseSecurity.js";
// REV-SEC-17: only https:// links (or site /asset paths for images) may be stored.
import { safeUrl } from "./validators.js";

const projectSchema = new mongoose.Schema(
  {
    // Project title, required. Duplicate titles are currently not allowed.
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      unique: true,
    },

    // Full project description, required.
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },

    // An array of technology names.
    // Example: ["React", "Express", "MongoDB"]

    techStack: {
      type: [
        {
          type: String,
          trim: true,
          minlength: 1,
          maxlength: 60,
        },
      ],
      default: [],
      validate: {
        validator: function (technologies) {
          const normalized = technologies.map((technology) =>
            technology.toLowerCase(),
          );

          const uniqueTechnologies = new Set(normalized);

          return (
            technologies.length <= 20 &&
            uniqueTechnologies.size === technologies.length
          );
        },
        message: "Choose up to 20 technologies without duplicates.",
      },
    },

    imageUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
      // REV-SEC-17: https:// address or a site path such as /images/project.png.
      validate: safeUrl({ allowRelative: true }),
    },

    liveUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
      // REV-SEC-17: a full https:// address (no javascript: links).
      validate: safeUrl(),
    },

    githubUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
      // REV-SEC-17: a full https:// address (no javascript: links).
      validate: safeUrl(),
    },
  },
  {
    timestamps: true,
    collection: "projects",
  },
);

const Project = mongoose.model("Project", projectSchema);

export default Project;
