const router = require("express").Router();
const pool = require("../db");

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/users/search?q=username
// Used by GameNightCreator to look up a registered user by username.
// Returns the user object if found, or 404 so the caller can fall back to guest.
// IMPORTANT: Must be registered BEFORE /:id routes or Express matches "search" as id.
// ──────────────────────────────────────────────────────────────────────────────
router.get("/search", async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: "Query required" });
  try {
    const result = await pool.query(
      "SELECT id, username, email FROM users WHERE username ILIKE $1 LIMIT 1",
      [q]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ──────────────────────────────────────────────────────────────────────────────
// GET /api/users/:id/stats
// Returns: win_rate (%), wins, total_games, points, podium breakdown
// Points: last=0, ..., winner=(n-1 players)
// ──────────────────────────────────────────────────────────────────────────────
router.get("/:id/stats", async (req, res) => {
  try {
    const result = await pool.query(
      `WITH player_results AS (
         SELECT
           gr.position,
           COUNT(*) OVER (PARTITION BY gp.id) AS total_players
         FROM attendees a
         JOIN game_results gr ON gr.attendee_id = a.id
         JOIN games_played gp ON gp.id = gr.games_played_id
         WHERE a.user_id = $1 AND gp.is_complete = TRUE
       )
       SELECT
         COUNT(*)                                                        AS total_games,
         SUM(CASE WHEN position = 1 THEN 1 ELSE 0 END)                  AS wins,
         SUM(CASE WHEN position = 2 THEN 1 ELSE 0 END)                  AS second_place,
         SUM(CASE WHEN position = 3 THEN 1 ELSE 0 END)                  AS third_place,
         SUM(CASE WHEN position > 3 THEN 1 ELSE 0 END)                  AS no_podium,
         SUM(total_players - position)                                   AS total_points,
         ROUND(
           100.0 * SUM(CASE WHEN position = 1 THEN 1 ELSE 0 END)
           / NULLIF(COUNT(*), 0), 1
         )                                                               AS win_rate
       FROM player_results`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/users/:id/stats/by-game
// Returns win rate per game title for bar chart
// ──────────────────────────────────────────────────────────────────────────────
router.get("/:id/stats/by-game", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         g.name AS game_name,
         COUNT(*)                                                          AS total_games,
         SUM(CASE WHEN gr.position = 1 THEN 1 ELSE 0 END)                AS wins,
         ROUND(
           100.0 * SUM(CASE WHEN gr.position = 1 THEN 1 ELSE 0 END)
           / NULLIF(COUNT(*), 0), 1
         )                                                                AS win_rate
       FROM attendees a
       JOIN game_results gr ON gr.attendee_id = a.id
       JOIN games_played gp ON gp.id = gr.games_played_id
       JOIN games g ON g.id = gp.game_id
       WHERE a.user_id = $1 AND gp.is_complete = TRUE
       GROUP BY g.id, g.name
       HAVING COUNT(*) >= 1
       ORDER BY win_rate DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/users/:id/history
// Returns recent games this user participated in
// ──────────────────────────────────────────────────────────────────────────────
router.get("/:id/history", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         g.name           AS game_name,
         gn.name          AS night_name,
         gn.played_at,
         gr.position,
         COUNT(*) OVER (PARTITION BY gp.id) AS total_players,
         (gr.position = 1)                  AS is_win
       FROM attendees a
       JOIN game_results gr  ON gr.attendee_id   = a.id
       JOIN games_played gp  ON gp.id            = gr.games_played_id
       JOIN games g          ON g.id             = gp.game_id
       JOIN game_nights gn   ON gn.id            = gp.game_night_id
       WHERE a.user_id = $1 AND gp.is_complete = TRUE
       ORDER BY COALESCE(gn.played_at, gn.created_at) DESC
       LIMIT 20`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;