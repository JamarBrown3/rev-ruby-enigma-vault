// imports for the Game model and Post.
// security input.js is for the HttpError class, which is used to throw errors with specific HTTP status codes and messages.
// access.js is for the readObjectId and notFound functions, which are used to validate and handle ObjectId values and not found errors.

import Game from "../models/Game.js";
import Post from "../models/Post.js";
import { HttpError } from "../security/input.js";
import { readObjectId, notFound } from "../security/access.js";

// SECTION 1 HELPER FUNCTIONS ---------

// Helper function: a value must be non-empty text, up to 'max' characters.
function text(value, label, max) {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) {
    throw new HttpError(400, `${label} must be 1-${max} characters long.`);
  }
  return value.trim();
}

// Helper function: copy only the allowed game fields from req.body, checking each one.
// partial false = creating (required fields must be sent)
// partial: true = updating (oonly change what was sent)
function pickGameFields(body, { partial }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Send a JSON object.");
  }

  // validate each field if it is present, and then copy it to a new json object.
  const allowed = [
    "title",
    "description",
    "platform",
    "genre",
    "releaseYear",
    "coverImage",
    "headerImage",
    "playtimeHours",
  ];

  // using a filter to find any unknown fields in the request body that are not in the allowed list.
  // if there are any unknown fields, it throws an HttpError with a 400 status code and a message indicating which fields are not allowed.
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length)
    throw new HttpError(400, `Unsupported field: ${unknown[0]}`);

  // out is an empty object that will hold the validated and sanitized fields from the request body.
  const out = {};
  // has is a helper function that checks if a specific key exists in the request body and is not undefined.
  // It returns true if the key exists and false otherwise.
  const has = (key) => body[key] !== undefined;

  // seeing if all the required fields are present in the request body. If any required field is missing,
  // it throws an HttpError with a 400 status code and a message indicating which field is required.
  if (!partial || has("title")) out.title = text(body.title, "Title", 200);
  if (!partial || has("description"))
    out.description = text(body.description, "Description", 10000);
  if (!partial || has("platform"))
    out.platform = text(body.platform, "Platform", 100);
  if (!partial || has("genre")) out.genre = text(body.genre, "Genre", 100);
  if (!partial || has("releaseYear")) {
    // check if release year is a whole number between 1950 and next year.
    const year = body.releaseYear;
    const maxYear = new Date().getFullYear() + 1;
    if (!Number.isInteger(year) || year < 1950 || year > maxYear) {
      throw new HttpError(
        400,
        `Release Year must be a whole number between 1950 and ${maxYear}.`,
      );
    }
    out.releaseYear = year;
  }
  if (!partial || has("coverImage"))
    out.coverImage = text(body.coverImage, "Cover Image", 2000);
  if (has("headerImage"))
    out.headerImage = text(body.headerImage, "Header Image", 2000);
  if (has("playtimeHours")) {
    const hours = body.playtimeHours;
    if (typeof hours !== "number" || !Number.isFinite(hours) || hours < 0) {
      throw new HttpError(400, "Playtime Hours must be a number of 0 or more.");
    }
    out.playtimeHours = hours;
  }
  return out;
}

// SECTION 2 CONTROLLER FUNCTIONS ---------

// POST /api/games (admin only)
// SQL version: INSERT INTO Games (title, description, platform, genre, releaseYear,
//  coverImage, headerImage, playtimeHours) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;
const createGame = async (req, res) => {
  const game = await Game.create(pickGameFields(req.body, { partial: false }));
  res.status(201).json(game);
};

// GET /api/games?page=1 (anyone can get all games)
// ?? is the nullish coalescing operator (“use the right side if the left is null or undefined”).
// The optional chaining operator is ? which is used to access the page property of req.query safely,
//  without throwing an error if req.query is null or undefined.
const getGames = async (req, res) => {
  const raw = req.query.page ?? "1";
  if (typeof raw !== "string" || !/^\d{1,4}$/.test(raw)) {
    throw new HttpError(400, "Page must be a whole number between 1 and 1000.");
  }
  const page = Number(raw);
  if (page < 1 || page > 1000) {
    throw new HttpError(400, "page must be a whole number between 1 and 1000.");
  }
  // limit is a constant that defines the maximum number of games to return per page. In this case, it is set to 24.
  const limit = 24;
  // mongoose's find method is used to retrieve all games from the database.
  // The skip method is used to skip a certain number of games based on the page number and limit,
  // and the limit method is used to limit the number of games returned to the specified limit.
  const games = await Game.find({})
    .sort({ title: 1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.status(200).json(games);
};

// GET /api/games/:id (anyone can get a specific game by id)
// SQL version: SELECT * FROM games WHERE id = $1;
const getGame = async (req, res) => {
  const game = await Game.findById(readObjectId(req.params.id));
  // if the game is not found, it throws a notFound error with a 404 status code and a message
  //  indicating that the game was not found.
  if (!game) throw notFound();
  res.status(200).json(game);
};
// PATCH /api/games/:id (admin only)
const updateGame = async (req, res) => {
  const game = await Game.findById(readObjectId(req.params.id));
  if (!game) throw notFound();
  Object.assign(game, pickGameFields(req.body, { partial: true }));
  await game.save();
  res.status(200).json(game);
};

const deleteGame = async (req, res) => {
  const id = readObjectId(req.params.id);
  const game = await Game.findById(id);
  if (!game) throw notFound();
  if (await Post.exists({ gameId: id })) {
    throw new HttpError(
      409,
      "This game still has reviews. Delete the reviews first or move them.",
    );
  }
  await game.deleteOne();
  res.status(204).end();
};

export default {
  createGame,
  getGames,
  getGame,
  updateGame,
  deleteGame,
};
