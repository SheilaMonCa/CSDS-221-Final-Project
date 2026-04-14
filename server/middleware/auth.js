const jwt = require('jsonwebtoken');

/**
 * Verifies the Supabase JWT sent as "Authorization: Bearer <token>".
 * Sets req.userId (UUID string) for use in protected routes.
 *
 * SUPABASE_JWT_SECRET lives in server/.env
 * Find it at: Supabase dashboard → Project Settings → Data API → JWT Secret
 */
module.exports = function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    req.userId = payload.sub; // Supabase UUID
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
