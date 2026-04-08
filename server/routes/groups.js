const router = require('express').Router();
const pool = require('../db');

// Create a group
router.post('/', async (req, res) => {
  const { name, user_id } = req.body;
  try {
    const group = await pool.query(
      'INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING *',
      [name, user_id]
    );
    // Automatically add creator as a member
    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [group.rows[0].id, user_id]
    );
    res.json(group.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all groups for a user
router.get('/user/:user_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.* FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = $1`,
      [req.params.user_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Add a member to a group by username
router.post('/:group_id/members', async (req, res) => {
  const { username } = req.body;
  try {
    const user = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (!user.rows[0]) return res.status(404).json({ error: 'User not found' });
    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [req.params.group_id, user.rows[0].id]
    );
    res.json({ message: 'Member added' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get members of a group
router.get('/:group_id/members', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username FROM users u
       JOIN group_members gm ON u.id = gm.user_id
       WHERE gm.group_id = $1`,
      [req.params.group_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a group
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM groups WHERE id = $1', [req.params.id]);
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;