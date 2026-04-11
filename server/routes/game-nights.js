const router = require('express').Router();
const pool = require('../db');

// Step 1: Create a new Game Night event
router.post('/', async (req, res) => {
  const { name, group_id, created_by, attendees } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const nightRes = await client.query(
      'INSERT INTO game_nights (name, played_at, group_id, created_by) VALUES ($1, NOW(), $2, $3) RETURNING id',
      [name, group_id, created_by]
    );
    const game_night_id = nightRes.rows[0].id;

    for (const person of attendees) {
      await client.query(
        'INSERT INTO attendees (game_night_id, user_id, guest_name) VALUES ($1, $2, $3)',
        [game_night_id, person.user_id || null, person.guest_name || null]
      );
    }
    await client.query('COMMIT');
    res.json({ game_night_id });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
});

// Step 2: Log a specific game played during that night
router.post('/:id/games', async (req, res) => {
  const { game_id, game_type, participants } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const gamePlayedRes = await client.query(
      'INSERT INTO games_played (game_night_id, game_id, game_type, is_complete) VALUES ($1, $2, $3, TRUE) RETURNING id',
      [req.params.id, game_id, game_type]
    );
    const games_played_id = gamePlayedRes.rows[0].id;

    for (const p of participants) {
      await client.query(
        'INSERT INTO game_participants (games_played_id, attendee_id) VALUES ($1, $2)',
        [games_played_id, p.attendee_id]
      );
      await client.query(
        'INSERT INTO game_results (games_played_id, attendee_id, position) VALUES ($1, $2, $3)',
        [games_played_id, p.attendee_id, p.position]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
});

module.exports = router;