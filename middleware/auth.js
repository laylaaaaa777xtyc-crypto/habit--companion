const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'habit_companion_secret_2024_change_in_prod';

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' });
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token 已过期，请重新登录' });
  }
};

module.exports.JWT_SECRET = JWT_SECRET;
