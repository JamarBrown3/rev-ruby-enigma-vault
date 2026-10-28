import { pool } from "../config/database.js";

const createTripDestination = async (req, res) => {
  const { trip_id, destination_id } = req.body || {};
  if (![trip_id, destination_id].every((id) => Number.isSafeInteger(id) && id > 0)) {
    return res.status(400).json({ error: "trip_id and destination_id must be positive integer JSON numbers." });
  }
  try {
    // Both records already exist. This inserts only their relationship.
    const results = await pool.query(
      "INSERT INTO trips_destinations (trip_id, destination_id) VALUES ($1, $2) RETURNING *",
      [trip_id, destination_id],
    );
    res.status(201).json(results.rows[0]);
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "This destination is already connected to this trip." });
    if (error.code === "23503") return res.status(404).json({ error: "Trip or destination not found." });
    console.error(error.message);
    res.status(500).json({ error: "Unable to connect trip and destination." });
  }
};

const getTripsDestinations = async (req, res) => {
  try {
    const results = await pool.query("SELECT * FROM trips_destinations ORDER BY trip_id, destination_id");
    res.status(200).json(results.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Unable to load trip connections." });
  }
};

const getAllTrips = async (req, res) => {
  try {
    // Follow the join table from a destination to its trips.
    const results = await pool.query(
      `SELECT trips.* FROM trips
       INNER JOIN trips_destinations ON trips.id = trips_destinations.trip_id
       WHERE trips_destinations.destination_id = $1 ORDER BY trips.id ASC`,
      [req.params.destination_id],
    );
    res.status(200).json(results.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Unable to load trips for this destination." });
  }
};

const getAllDestinations = async (req, res) => {
  try {
    // Follow the same connection in the opposite direction.
    const results = await pool.query(
      `SELECT destinations.* FROM destinations
       INNER JOIN trips_destinations ON destinations.id = trips_destinations.destination_id
       WHERE trips_destinations.trip_id = $1 ORDER BY destinations.id ASC`,
      [req.params.trip_id],
    );
    res.status(200).json(results.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Unable to load destinations for this trip." });
  }
};

export default { createTripDestination, getTripsDestinations, getAllTrips, getAllDestinations };
