const router = require("express").Router();
const pool = require("../db");
const crypto = require("crypto");

// Generate a short unique invite code
const generateInviteCode = () =>
  crypto.randomBytes(4).toString("hex").toUpperCase(); // e.g. "A3F8C1D2"

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/groups  — create a group
// ──────────────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { name } = req.body;
  const user_id = parseInt(req.body.user_id, 10);
  if (!user_id) return res.status(400).json({ error: "Invalid user_id" });

  // Generate a collision-free invite code BEFORE opening a transaction.
  // Querying outside a transaction means a failed uniqueness check won't
  // poison the client connection.
  let invite_code;
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateInviteCode();
    const existing = await pool.query(
      "SELECT id FROM groups WHERE invite_code = $1",
      [candidate]
    );
    if (existing.rows.length === 0) {
      invite_code = candidate;
      break;
    }
  }
  if (!invite_code) {
    return res.status(500).json({ error: "Could not generate a unique invite code. Please try again." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inserted = await client.query(
      "INSERT INTO groups (name, invite_code, created_by) VALUES ($1, $2, $3) RETURNING *",
      [name, invite_code, user_id]
    );

    await client.query(
      "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)",
      [inserted.rows[0].id, user_id]
    );

    await client.query("COMMIT");
    res.json(inserted.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/groups/user/:user_id  — all groups a user belongs to
// ──────────────────────────────────────────────────────────────────────────────
router.get("/user/:user_id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*,
              COUNT(DISTINCT gm.user_id) AS member_count
       FROM groups g
       JOIN group_members gm_self ON gm_self.group_id = g.id AND gm_self.user_id = $1
       JOIN group_members gm ON gm.group_id = g.id
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [req.params.user_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/groups/:id  — single group detail
// ──────────────────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM groups WHERE id = $1", [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Group not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/groups/:id/members  — members of a group
// ──────────────────────────────────────────────────────────────────────────────
router.get("/:id/members", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, gm.joined_at
       FROM users u
       JOIN group_members gm ON u.id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/groups/:group_id/members  — add member by username
// ──────────────────────────────────────────────────────────────────────────────
router.post("/:group_id/members", async (req, res) => {
  const { username } = req.body;
  try {
    const user = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (!user.rows[0]) return res.status(404).json({ error: "User not found" });
    await pool.query(
      "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [req.params.group_id, user.rows[0].id]
    );
    res.json({ message: "Member added" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/groups/join  — join a group by invite code
// Body: { invite_code, user_id }
// ──────────────────────────────────────────────────────────────────────────────
router.post("/join", async (req, res) => {
  const { invite_code, user_id } = req.body;
  try {
    const group = await pool.query("SELECT * FROM groups WHERE invite_code = $1", [invite_code]);
    if (!group.rows[0]) return res.status(404).json({ error: "Invalid invite code" });
    await pool.query(
      "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [group.rows[0].id, user_id]
    );
    res.json(group.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/groups/:id/game-nights  — recent game nights for a group
// ──────────────────────────────────────────────────────────────────────────────
router.get("/:id/game-nights", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT gn.id, gn.name, gn.played_at, gn.created_at,
              COUNT(DISTINCT gp.id) AS game_count
       FROM game_nights gn
       JOIN groups_present grp ON grp.game_night_id = gn.id
       LEFT JOIN games_played gp ON gp.game_night_id = gn.id
       WHERE grp.group_id = $1
       GROUP BY gn.id
       ORDER BY COALESCE(gn.played_at, gn.created_at) DESC
       LIMIT 20`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/groups/:id/leaderboard  — all-time wins leaderboard for a group
// Points system: last place = 0 pts, ..., winner = (n-1) pts
// ──────────────────────────────────────────────────────────────────────────────
router.get("/:id/leaderboard", async (req, res) => {
  try {
    const result = await pool.query(
      `WITH group_nights AS (
         SELECT gn.id AS night_id
         FROM game_nights gn
         JOIN groups_present grp ON grp.game_night_id = gn.id
         WHERE grp.group_id = $1
       ),
       player_results AS (
         SELECT
           a.user_id,
           gp.id AS games_played_id,
           gr.position,
           COUNT(*) OVER (PARTITION BY gp.id) AS total_players
         FROM games_played gp
         JOIN group_nights gn ON gn.night_id = gp.game_night_id
         JOIN game_results gr ON gr.games_played_id = gp.id
         JOIN attendees a ON a.id = gr.attendee_id
         WHERE a.user_id IS NOT NULL AND gp.is_complete = TRUE
       )
       SELECT
         u.id,
         u.username,
         COUNT(*) AS games,
         SUM(pr.total_players - pr.position) AS points,
         SUM(CASE WHEN pr.position = 1 THEN 1 ELSE 0 END) AS wins
       FROM player_results pr
       JOIN users u ON u.id = pr.user_id
       GROUP BY u.id, u.username
       ORDER BY points DESC, wins DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/groups/:id  — delete a group
// ──────────────────────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM groups WHERE id = $1", [req.params.id]);
    res.json({ message: "Group deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/groups/:id/members/:user_id  — leave a group
// ──────────────────────────────────────────────────────────────────────────────
router.delete("/:id/members/:user_id", async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM group_members WHERE group_id = $1 AND user_id = $2",
      [req.params.id, req.params.user_id]
    );
    res.json({ message: "Left group" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;