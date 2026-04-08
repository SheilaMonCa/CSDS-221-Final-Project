const router = require('express').Router();
const pool = require('../db');

// Log a new session
router.post('/', async (req, res) => {
  const { group_id, game_id, played_at, players } = req.body;
  // players = [{ user_id, score }, ...]
  try {
    const session = await pool.query(
      'INSERT INTO sessions (group_id, game_id, played_at) VALUES ($1, $2, $3) RETURNING *',
      [group_id, game_id, played_at || new Date()]
    );
    const session_id = session.rows[0].id;
    for (const player of players) {
      await pool.query(
        'INSERT INTO session_players (session_id, user_id, score) VALUES ($1, $2, $3)',
        [session_id, player.user_id, player.score]
      );
    }
    res.json(session.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all sessions for a group
router.get('/group/:group_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, g.name as game_name FROM sessions s
       JOIN games g ON s.game_id = g.id
       WHERE s.group_id = $1
       ORDER BY s.played_at DESC`,
      [req.params.group_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get leaderboard for a group
router.get('/group/:group_id/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.username,
              COUNT(*) as games_played,
              SUM(sp.score) as total_score,
              SUM(CASE WHEN sp.score = max_scores.max_score THEN 1 ELSE 0 END) as wins
       FROM session_players sp
       JOIN users u ON sp.user_id = u.id
       JOIN sessions s ON sp.session_id = s.id
       JOIN (
         SELECT session_id, MAX(score) as max_score
         FROM session_players GROUP BY session_id
       ) max_scores ON sp.session_id = max_scores.session_id
       WHERE s.group_id = $1
       GROUP BY u.username
       ORDER BY wins DESC`,
      [req.params.group_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a session
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Session deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;