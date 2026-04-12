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
// Names are normalized to trimmed lowercase so "Catan", " catan ", "CATAN" all resolve to the same entry
router.post('/', async (req, res) => {
  const { name } = req.body;
  const normalized = (name || '').trim().toLowerCase().replace(/^\w/, c => c.toUpperCase());
  if (!normalized) return res.status(400).json({ error: 'Game name is required' });

  try {
    await pool.query(
      'INSERT INTO games (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [normalized]
    );
    const result = await pool.query('SELECT * FROM games WHERE name = $1', [normalized]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
