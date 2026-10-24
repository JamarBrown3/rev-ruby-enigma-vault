import mongoose from "mongoose";

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
    },

    liveUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    githubUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
    collection: "projects",
  },
);

const Project = mongoose.model("Project", projectSchema);

export default Project;
