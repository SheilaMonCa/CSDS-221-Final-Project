const router = require("express").Router();
const pool = require("../db");

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/game-nights/:id  — full night detail (night, attendees, games)
// ──────────────────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const nightRes = await pool.query(
      "SELECT * FROM game_nights WHERE id = $1",
      [req.params.id]
    );
    if (!nightRes.rows[0]) return res.status(404).json({ error: "Not found" });

    // Attendees (registered users + guests)
    const attendeesRes = await pool.query(
      `SELECT a.id, a.user_id, a.guest_name, u.username
       FROM attendees a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.game_night_id = $1
       ORDER BY a.id`,
      [req.params.id]
    );

    // Games played with their results/rounds
    const gamesRes = await pool.query(
      `SELECT gp.id, gp.game_type, gp.is_complete, g.name AS game_name
       FROM games_played gp
       JOIN games g ON g.id = gp.game_id
       WHERE gp.game_night_id = $1
       ORDER BY gp.created_at`,
      [req.params.id]
    );

    // For each game, attach participants + results or rounds
    const games = await Promise.all(
      gamesRes.rows.map(async (gp) => {
        const participantsRes = await pool.query(
          `SELECT gpart.attendee_id,
                  COALESCE(u.username, a.guest_name) AS name,
                  gr.position
           FROM game_participants gpart
           JOIN attendees a ON a.id = gpart.attendee_id
           LEFT JOIN users u ON u.id = a.user_id
           LEFT JOIN game_results gr
             ON gr.games_played_id = gpart.games_played_id
            AND gr.attendee_id = gpart.attendee_id
           WHERE gpart.games_played_id = $1`,
          [gp.id]
        );

        let rounds = [];
        if (gp.game_type === "cumulative") {
          const roundsRes = await pool.query(
            `SELECT gr.id AS round_id, gr.round_number,
                    rs.attendee_id, rs.score,
                    COALESCE(u.username, a.guest_name) AS name
             FROM game_rounds gr
             JOIN round_scores rs ON rs.round_id = gr.id
             JOIN attendees a ON a.id = rs.attendee_id
             LEFT JOIN users u ON u.id = a.user_id
             WHERE gr.games_played_id = $1
             ORDER BY gr.round_number`,
            [gp.id]
          );
          rounds = roundsRes.rows;
        }

        return { ...gp, participants: participantsRes.rows, rounds };
      })
    );

    res.json({
      night: nightRes.rows[0],
      attendees: attendeesRes.rows,
      games,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/game-nights  — create a new game night
// Body: { name, created_by, attendees: [{user_id?} | {guest_name}], group_ids?: [] }
// ──────────────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { name, created_by, attendees = [], group_ids = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Create the game night
    const nightRes = await client.query(
      "INSERT INTO game_nights (name, played_at, created_by) VALUES ($1, NOW(), $2) RETURNING id",
      [name, created_by]
    );
    const game_night_id = nightRes.rows[0].id;

    // 2. Link groups (groups_present table)
    for (const group_id of group_ids) {
      await client.query(
        "INSERT INTO groups_present (game_night_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [game_night_id, group_id]
      );
    }

    // 3. Insert attendees (deduplicate by user_id)
    const seenUserIds = new Set();
    for (const person of attendees) {
      const userId = person.user_id || person.userId || null;
      const guestName = person.guest_name || person.name || null;

      if (userId) {
        if (seenUserIds.has(userId)) continue;
        seenUserIds.add(userId);
        await client.query(
          "INSERT INTO attendees (game_night_id, user_id, guest_name) VALUES ($1, $2, NULL)",
          [game_night_id, userId]
        );
      } else if (guestName) {
        await client.query(
          "INSERT INTO attendees (game_night_id, user_id, guest_name) VALUES ($1, NULL, $2)",
          [game_night_id, guestName]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ game_night_id });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/game-nights/:id/end  — mark a game night as ended (view-only)
// ──────────────────────────────────────────────────────────────────────────────
router.put("/:id/end", async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE game_nights SET is_active = FALSE WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
    res.json({ success: true, night: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/game-nights/:id/games  — create a game shell + participants
// Body: { game_id, game_type, is_complete?, participants: [{attendee_id, position}] }
// ──────────────────────────────────────────────────────────────────────────────
router.post("/:id/games", async (req, res) => {
  const { game_id, game_type, participants, is_complete = true } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const gamePlayedRes = await client.query(
      "INSERT INTO games_played (game_night_id, game_id, game_type, is_complete) VALUES ($1, $2, $3, $4) RETURNING id",
      [req.params.id, game_id, game_type, is_complete]
    );
    const games_played_id = gamePlayedRes.rows[0].id;

    for (const p of participants) {
      await client.query(
        "INSERT INTO game_participants (games_played_id, attendee_id) VALUES ($1, $2)",
        [games_played_id, p.attendee_id]
      );
      if (is_complete && p.position != null) {
        await client.query(
          "INSERT INTO game_results (games_played_id, attendee_id, position) VALUES ($1, $2, $3)",
          [games_played_id, p.attendee_id, p.position]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ success: true, games_played_id });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/game-nights/:id/games/:gamesPlayedId/positions
// ──────────────────────────────────────────────────────────────────────────────
router.put("/:id/games/:gamesPlayedId/positions", async (req, res) => {
  const { gamesPlayedId } = req.params;
  const { participants = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const p of participants) {
      await client.query(
        `INSERT INTO game_results (games_played_id, attendee_id, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (games_played_id, attendee_id) DO UPDATE SET position = $3`,
        [gamesPlayedId, p.attendee_id, p.position]
      );
    }

    await client.query(
      "UPDATE games_played SET is_complete = TRUE WHERE id = $1",
      [gamesPlayedId]
    );

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/game-nights/:id/games/:gamesPlayedId/rounds
// ──────────────────────────────────────────────────────────────────────────────
router.post("/:id/games/:gamesPlayedId/rounds", async (req, res) => {
  const { gamesPlayedId } = req.params;
  const { scores = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const countRes = await client.query(
      "SELECT COUNT(*) FROM game_rounds WHERE games_played_id = $1",
      [gamesPlayedId]
    );
    const round_number = parseInt(countRes.rows[0].count) + 1;

    const roundRes = await client.query(
      "INSERT INTO game_rounds (games_played_id, round_number) VALUES ($1, $2) RETURNING id",
      [gamesPlayedId, round_number]
    );
    const round_id = roundRes.rows[0].id;

    for (const s of scores) {
      await client.query(
        "INSERT INTO round_scores (round_id, attendee_id, score) VALUES ($1, $2, $3)",
        [round_id, s.attendee_id, s.score]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, round_id, round_number });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/game-nights/:id/games/:gamesPlayedId/finalize
// Body: { higher_is_better: bool }
// ──────────────────────────────────────────────────────────────────────────────
router.post("/:id/games/:gamesPlayedId/finalize", async (req, res) => {
  const { gamesPlayedId } = req.params;
  const { higher_is_better = true } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const totalsRes = await client.query(
      `SELECT rs.attendee_id, SUM(rs.score) AS total
       FROM round_scores rs
       JOIN game_rounds gr ON gr.id = rs.round_id
       WHERE gr.games_played_id = $1
       GROUP BY rs.attendee_id`,
      [gamesPlayedId]
    );

    const sorted = totalsRes.rows.sort((a, b) =>
      higher_is_better
        ? Number(b.total) - Number(a.total)
        : Number(a.total) - Number(b.total)
    );

    for (let i = 0; i < sorted.length; i++) {
      await client.query(
        `INSERT INTO game_results (games_played_id, attendee_id, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (games_played_id, attendee_id) DO UPDATE SET position = $3`,
        [gamesPlayedId, sorted[i].attendee_id, i + 1]
      );
    }

    await client.query(
      "UPDATE games_played SET is_complete = TRUE WHERE id = $1",
      [gamesPlayedId]
    );

    await client.query("COMMIT");
    res.json({ success: true, positions: sorted.map((r, i) => ({ ...r, position: i + 1 })) });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
