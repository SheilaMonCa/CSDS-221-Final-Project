const router = require('express').Router();
const pool   = require('../db');

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/users/search?q=username
// Must be BEFORE /:id routes — Express would match "search" as an id param.
// ──────────────────────────────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    const result = await pool.query(
      'SELECT id, username, email FROM users WHERE username ILIKE $1 LIMIT 1',
      [q]
    );
    if (!result.rows[0]) return res.json({ found: false });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/users/:id/profile
// Returns id, username, email — used by AuthContext after login to enrich the
// user object so user.username works everywhere without changing other files.
// Must be BEFORE /:id/stats etc.
// ──────────────────────────────────────────────────────────────────────────────
router.get('/:id/profile', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/users/:id/stats
// ──────────────────────────────────────────────────────────────────────────────
router.get('/:id/stats', async (req, res) => {
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
// GET /api/users/:id/chips
// ──────────────────────────────────────────────────────────────────────────────
router.get('/:id/chips', async (req, res) => {
  try {
    const [streakRes, nightsRes, topGameRes, avgRes] = await Promise.all([
      pool.query(
        `SELECT gr.position
         FROM attendees a
         JOIN game_results gr ON gr.attendee_id = a.id
         JOIN games_played gp ON gp.id = gr.games_played_id
         JOIN game_nights gn ON gn.id = gp.game_night_id
         WHERE a.user_id = $1 AND gp.is_complete = TRUE
         ORDER BY COALESCE(gn.played_at, gn.created_at) DESC, gp.id DESC`,
        [req.params.id]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT game_night_id) AS total_nights FROM attendees WHERE user_id = $1`,
        [req.params.id]
      ),
      pool.query(
        `SELECT g.name, COUNT(*) AS play_count
         FROM attendees a
         JOIN game_results gr ON gr.attendee_id = a.id
         JOIN games_played gp ON gp.id = gr.games_played_id
         JOIN games g ON g.id = gp.game_id
         WHERE a.user_id = $1 AND gp.is_complete = TRUE
         GROUP BY g.id, g.name ORDER BY play_count DESC LIMIT 1`,
        [req.params.id]
      ),
      pool.query(
        `SELECT ROUND(AVG(gr.position::numeric), 1) AS avg_position
         FROM attendees a
         JOIN game_results gr ON gr.attendee_id = a.id
         JOIN games_played gp ON gp.id = gr.games_played_id
         WHERE a.user_id = $1 AND gp.is_complete = TRUE`,
        [req.params.id]
      ),
    ]);

    let streak = 0;
    for (const row of streakRes.rows) {
      if (Number(row.position) === 1) streak++;
      else break;
    }

    res.json({
      streak,
      total_nights:      Number(nightsRes.rows[0]?.total_nights    ?? 0),
      most_played_game:  topGameRes.rows[0]?.name                  ?? null,
      most_played_count: Number(topGameRes.rows[0]?.play_count     ?? 0),
      avg_position:      avgRes.rows[0]?.avg_position ? Number(avgRes.rows[0].avg_position) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/users/:id/stats/by-game
// ──────────────────────────────────────────────────────────────────────────────
router.get('/:id/stats/by-game', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         g.name AS game_name,
         COUNT(*) AS total_games,
         SUM(CASE WHEN gr.position = 1 THEN 1 ELSE 0 END) AS wins,
         ROUND(100.0 * SUM(CASE WHEN gr.position = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS win_rate
       FROM attendees a
       JOIN game_results gr ON gr.attendee_id = a.id
       JOIN games_played gp ON gp.id = gr.games_played_id
       JOIN games g ON g.id = gp.game_id
       WHERE a.user_id = $1 AND gp.is_complete = TRUE
       GROUP BY g.id, g.name HAVING COUNT(*) >= 1 ORDER BY win_rate DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/users/:id/history
// ──────────────────────────────────────────────────────────────────────────────
router.get('/:id/history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         g.name AS game_name, g.id AS game_id,
         gp.id AS games_played_id, gp.game_type,
         gn.id AS game_night_id, gn.name AS night_name, gn.played_at,
         gr.position,
         (SELECT COUNT(*) FROM game_participants gpart WHERE gpart.games_played_id = gp.id) AS total_players,
         (gr.position = 1) AS is_win
       FROM attendees a
       JOIN game_results gr  ON gr.attendee_id  = a.id
       JOIN games_played gp  ON gp.id           = gr.games_played_id
       JOIN games g          ON g.id            = gp.game_id
       JOIN game_nights gn   ON gn.id           = gp.game_night_id
       WHERE a.user_id = $1 AND gp.is_complete = TRUE
       ORDER BY COALESCE(gn.played_at, gn.created_at) DESC LIMIT 20`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/users/:id/vs/:otherId
// ✅ Fixed: ANY($1::uuid[]) replaces ::int[], removed parseInt() on UUID strings
// ──────────────────────────────────────────────────────────────────────────────
router.get('/:id/vs/:otherId', async (req, res) => {
  const { id, otherId } = req.params;
  try {
    const usersRes = await pool.query(
      'SELECT id, username FROM users WHERE id = ANY($1::uuid[])',
      [[id, otherId]]
    );
    const userMap = {};
    usersRes.rows.forEach(u => { userMap[u.id] = u.username; });

    if (!userMap[id] || !userMap[otherId]) {
      return res.status(404).json({ error: 'One or both users not found' });
    }

    const sharedRes = await pool.query(
      `SELECT
         gp.id AS games_played_id, gn.id AS game_night_id,
         gn.name AS night_name,
         COALESCE(gn.played_at, gn.created_at) AS date,
         g.id AS game_id, g.name AS game_name,
         (SELECT COUNT(*) FROM game_results gr3 WHERE gr3.games_played_id = gp.id) AS total_players,
         gr1.position AS user1_position, gr2.position AS user2_position
       FROM games_played gp
       JOIN game_nights gn ON gn.id = gp.game_night_id
       JOIN games g        ON g.id  = gp.game_id
       JOIN attendees a1   ON a1.game_night_id = gn.id AND a1.user_id = $1
       JOIN game_results gr1 ON gr1.attendee_id = a1.id AND gr1.games_played_id = gp.id
       JOIN attendees a2   ON a2.game_night_id = gn.id AND a2.user_id = $2
       JOIN game_results gr2 ON gr2.attendee_id = a2.id AND gr2.games_played_id = gp.id
       WHERE gp.is_complete = TRUE
       ORDER BY COALESCE(gn.played_at, gn.created_at) ASC, gp.id ASC`,
      [id, otherId]
    );

    const rows = sharedRes.rows;

    if (rows.length === 0) {
      return res.json({
        user1: { id, username: userMap[id] },
        user2: { id: otherId, username: userMap[otherId] },
        total_shared: 0, overall: null, by_game: [], timeline: [], games: [],
      });
    }

    let u1Wins = 0, u2Wins = 0;
    const gameStats = {};
    rows.forEach(row => {
      const u1pos = Number(row.user1_position);
      const u2pos = Number(row.user2_position);
      if (u1pos === 1) u1Wins++;
      if (u2pos === 1) u2Wins++;
      const gid = Number(row.game_id);
      if (!gameStats[gid]) gameStats[gid] = { game_id: gid, game_name: row.game_name, total: 0, u1_wins: 0, u2_wins: 0 };
      gameStats[gid].total++;
      if (u1pos === 1) gameStats[gid].u1_wins++;
      if (u2pos === 1) gameStats[gid].u2_wins++;
    });

    const timeline = rows.map(row => ({
      games_played_id: Number(row.games_played_id),
      night_id:        Number(row.game_night_id),
      night_name:      row.night_name,
      date:            row.date,
      game_id:         Number(row.game_id),
      game_name:       row.game_name,
      user1_pts: Math.max(0, Number(row.total_players) - Number(row.user1_position)),
      user2_pts: Math.max(0, Number(row.total_players) - Number(row.user2_position)),
    }));

    const byGame = Object.values(gameStats)
      .sort((a, b) => b.total - a.total)
      .map(g => ({ ...g, u1_win_rate: Math.round(1000 * g.u1_wins / g.total) / 10, u2_win_rate: Math.round(1000 * g.u2_wins / g.total) / 10 }));

    res.json({
      user1: { id, username: userMap[id] },
      user2: { id: otherId, username: userMap[otherId] },
      total_shared: rows.length,
      overall: { user1_wins: u1Wins, user2_wins: u2Wins, user1_win_rate: Math.round(1000 * u1Wins / rows.length) / 10, user2_win_rate: Math.round(1000 * u2Wins / rows.length) / 10 },
      by_game: byGame,
      timeline,
      games: byGame.map(g => ({ id: g.game_id, name: g.game_name })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/users/history-detail/:gamesPlayedId
// Must be BEFORE /:id — otherwise Express matches gamesPlayedId as the id param.
// ──────────────────────────────────────────────────────────────────────────────
router.get('/history-detail/:gamesPlayedId', async (req, res) => {
  const { gamesPlayedId } = req.params;
  try {
    const gpRes = await pool.query(
      `SELECT gp.id, gp.game_type, gp.higher_is_better, g.name AS game_name
       FROM games_played gp JOIN games g ON g.id = gp.game_id WHERE gp.id = $1`,
      [gamesPlayedId]
    );
    if (!gpRes.rows[0]) return res.status(404).json({ error: 'Game not found' });
    const gp = gpRes.rows[0];

    const partRes = await pool.query(
      `SELECT COALESCE(u.username, a.guest_name) AS name, a.user_id, gr.position
       FROM game_participants gpart
       JOIN attendees a ON a.id = gpart.attendee_id
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN game_results gr ON gr.games_played_id = gpart.games_played_id AND gr.attendee_id = gpart.attendee_id
       WHERE gpart.games_played_id = $1 ORDER BY gr.position ASC NULLS LAST`,
      [gamesPlayedId]
    );

    let rounds = [];
    if (gp.game_type === 'cumulative' || gp.game_type === 'scores') {
      const roundsRes = await pool.query(
        `SELECT gr.round_number, rs.attendee_id, COALESCE(u.username, a.guest_name) AS name, rs.score
         FROM game_rounds gr
         JOIN round_scores rs ON rs.round_id = gr.id
         JOIN attendees a ON a.id = rs.attendee_id
         LEFT JOIN users u ON u.id = a.user_id
         WHERE gr.games_played_id = $1 ORDER BY gr.round_number`,
        [gamesPlayedId]
      );
      rounds = roundsRes.rows;
    }

    res.json({ ...gp, participants: partRes.rows, rounds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/users/:id  — update username in public.users
// Called from AccountModal after supabase.auth.updateUser() handles email/pass.
// ──────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  try {
    const result = await pool.query(
      'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, email',
      [username, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/users/:id  — anonymize DB rows then delete from Supabase Auth
// Uses the service role key server-side — never exposed to the frontend.
// ──────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes  = await client.query('SELECT username FROM users WHERE id = $1', [id]);
    const username = userRes.rows[0]?.username ?? 'Deleted User';

    // Preserve game history by converting user's attendee rows to guest rows
    await client.query(
      `UPDATE attendees SET guest_name = $1, user_id = NULL WHERE user_id = $2`,
      [`${username} (deleted)`, id]
    );
    await client.query('UPDATE game_nights SET created_by = NULL WHERE created_by = $1', [id]);
    await client.query('UPDATE groups     SET created_by = NULL WHERE created_by = $1', [id]);
    await client.query('DELETE FROM group_members WHERE user_id = $1', [id]);
    await client.query('DELETE FROM users WHERE id = $1', [id]);

    await client.query('COMMIT');

    // Delete from Supabase Auth using service role key (server-side only)
    const { createClient } = require('@supabase/supabase-js');
    const admin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);

    res.json({ message: 'Account deleted and data anonymized' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
