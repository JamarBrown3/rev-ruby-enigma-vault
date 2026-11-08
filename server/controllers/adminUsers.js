// REV-SEC-27 (added 2026-11-07): admin tools for member accounts.
// Only reachable through /api/admin, which app.js already locks to the admin
// (signed in with the 6-digit code) and protects with the CSRF check.
import User from "../models/User.js";
import { HttpError, readUsername, publicUser } from "../security/input.js";
import { readObjectId, notFound } from "../security/access.js";

// Body for a rename: { "username": "new_name", "reason": "optional note" }.
function readRenameBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Send a JSON object.");
  }
  const unknown = Object.keys(body).filter((key) => !["username", "reason"].includes(key));
  if (unknown.length) throw new HttpError(400, `Unsupported field: ${unknown[0]}`);

  let reason = "";
  if (body.reason !== undefined) {
    if (typeof body.reason !== "string" || body.reason.trim().length > 200) {
      throw new HttpError(400, "Reason must be text, up to 200 characters.");
    }
    reason = body.reason.trim();
  }

  // Same rules as registration: format, length, offensive, reserved, phone numbers.
  return { username: readUsername(body.username), reason };
}

// PATCH /api/admin/users/:id/username
// Force-renames a member whose name slipped past the filter, and records the
// old name in previousUsernames as an audit trail.
async function renameUser(req, res) {
  const id = readObjectId(req.params.id);
  const { username, reason } = readRenameBody(req.body);

  const user = await User.findById(id);
  if (!user) throw notFound();

  if (user.username.toLowerCase() === username.toLowerCase()) {
    throw new HttpError(400, "That's already this account's username.");
  }

  const oldName = user.username;
  try {
    // One update: change the name AND add the history entry together, so one
    // can never happen without the other.
    const updated = await User.findOneAndUpdate(
      { _id: id, username: oldName },
      {
        $set: { username },
        $push: {
          previousUsernames: {
            username: oldName,
            changedAt: new Date(),
            changedBy: req.authUser._id,
            reason,
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    // Someone else changed it in the meantime; ask the admin to try again.
    if (!updated) throw new HttpError(409, "The account changed. Reload and try again.");

    res.json({ user: publicUser(updated), previousUsername: oldName });
  } catch (error) {
    // The case-insensitive unique index says the new name is taken.
    if (error?.code === 11000) {
      throw new HttpError(409, "That username is not available.");
    }
    throw error;
  }
}

export default { renameUser };
