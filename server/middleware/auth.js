const router = require('express').Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ──────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
    res.json({ token, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ──────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'User not found' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ error: 'Wrong password' });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/update/:id  — update profile
// ──────────────────────────────────────────────────────────────────────────────
router.put('/update/:id', async (req, res) => {
  const { id } = req.params;
  const { username, email, newPass, currentPass } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(currentPass, user.password_hash);
    if (!match) return res.status(400).json({ error: 'Incorrect current password' });

    let newHash = user.password_hash;
    if (newPass) {
      newHash = await bcrypt.hash(newPass, 10);
    }

    const updateResult = await pool.query(
      'UPDATE users SET username = $1, email = $2, password_hash = $3 WHERE id = $4 RETURNING id, username, email',
      [username || user.username, email || user.email, newHash, id]
    );

    res.json({ user: updateResult.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/auth/delete/:id  — anonymize attendee rows, then delete user
// Attendee rows are preserved with user_id = NULL and a "Deleted User" guest_name
// so historical game data is retained.
// ──────────────────────────────────────────────────────────────────────────────
router.delete('/delete/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch a display name to preserve in history
    const userRes = await client.query('SELECT username FROM users WHERE id = $1', [id]);
    const username = userRes.rows[0]?.username ?? 'Deleted User';

    // 2. Anonymize: convert their attendee rows to guest rows
    //    The CHECK constraint requires exactly one of user_id/guest_name to be set,
    //    so we set guest_name first then clear user_id.
    await client.query(
      `UPDATE attendees
       SET guest_name = $1, user_id = NULL
       WHERE user_id = $2`,
      [`${username} (deleted)`, id]
    );

    // 3. Nullify created_by references
    await client.query('UPDATE game_nights SET created_by = NULL WHERE created_by = $1', [id]);
    await client.query('UPDATE groups SET created_by = NULL WHERE created_by = $1', [id]);

    // 4. Remove from group_members
    await client.query('DELETE FROM group_members WHERE user_id = $1', [id]);

    // 5. Delete the user record
    await client.query('DELETE FROM users WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({ message: 'Account deleted and data anonymized' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
