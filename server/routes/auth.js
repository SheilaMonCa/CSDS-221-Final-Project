const router = require('express').Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register
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

// Login
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

// --- NEW ROUTES ADDED BELOW ---

// Update Profile
router.put('/update/:id', async (req, res) => {
  const { id } = req.params;
  const { username, email, newPass, currentPass } = req.body;

  try {
    // 1. Fetch user to get the hash for comparison
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const user = result.rows[0];

    if (!user) return res.status(404).json({ error: 'User not found' });

    // 2. Verify current password
    const match = await bcrypt.compare(currentPass, user.password_hash);
    if (!match) return res.status(400).json({ error: 'Incorrect current password' });

    // 3. Hash new password if provided, else keep old hash
    let newHash = user.password_hash;
    if (newPass) {
      newHash = await bcrypt.hash(newPass, 10);
    }

    // 4. Update database
    const updateResult = await pool.query(
      'UPDATE users SET username = $1, email = $2, password_hash = $3 WHERE id = $4 RETURNING id, username, email',
      [username || user.username, email || user.email, newHash, id]
    );

    res.json({ user: updateResult.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete & Anonymize Account
router.delete('/delete/:id', async (req, res) => {
  const { id } = req.params;
  const ANONYMOUS_USER_ID = 0; // Ensure this ID exists in your DB

  try {
    // Re-assign all session history to Anonymous
    await pool.query('UPDATE session_players SET user_id = $1 WHERE user_id = $2', [ANONYMOUS_USER_ID, id]);
    
    // Delete the actual user record
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    
    res.json({ message: 'Account deleted and data anonymized' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;