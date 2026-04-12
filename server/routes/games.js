const router = require('express').Router();
const pool = require('../db');

// Get all games
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM games ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Add a new game (or return existing if name already exists)
router.post('/', async (req, res) => {
  const { name } = req.body;
  try {
    // INSERT ... ON CONFLICT returns nothing, so we upsert then SELECT
    await pool.query(
      'INSERT INTO games (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name]
    );
    const result = await pool.query('SELECT * FROM games WHERE name = $1', [name]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;