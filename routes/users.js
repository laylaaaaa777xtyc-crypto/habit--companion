const express = require('express');
const auth = require('../middleware/auth');
const { db, xpToNextLevel, xpPercent, LEVEL_THRESHOLDS, todayStr } = require('../db');

const router = express.Router();

router.get('/profile', auth, (req, res) => {
  const userId = req.user.id;
  const today = todayStr();

  const user = db.prepare('SELECT id, username, role_id, total_xp, level, streak_days FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const habitsTotal = db.prepare('SELECT COUNT(*) as cnt FROM habits WHERE user_id = ?').get(userId).cnt;
  const habitsCompletedToday = db.prepare(
    'SELECT COUNT(DISTINCT habit_id) as cnt FROM habit_logs WHERE user_id = ? AND checkin_date = ?'
  ).get(userId, today).cnt;

  const xpNext = xpToNextLevel(user.total_xp, user.level);
  const xpPct = xpPercent(user.total_xp, user.level);

  res.json({
    ...user,
    habits_total: habitsTotal,
    habits_completed_today: habitsCompletedToday,
    xp_to_next_level: xpNext,
    xp_percent: xpPct,
  });
});

router.put('/role', auth, (req, res) => {
  const { role_id } = req.body;
  const userId = req.user.id;

  if (!role_id || role_id < 1 || role_id > 5) {
    return res.status(400).json({ error: '角色ID无效，需在1-5之间' });
  }

  db.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(role_id, userId);
  const user = db.prepare('SELECT id, username, role_id, total_xp, level, streak_days FROM users WHERE id = ?').get(userId);
  res.json(user);
});

router.delete('/reset', auth, (req, res) => {
  const { confirm } = req.body;
  if (!confirm) {
    return res.status(400).json({ error: '请确认重置操作' });
  }

  const userId = req.user.id;

  db.prepare('DELETE FROM habit_logs WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM conversations WHERE user_id = ?').run(userId);
  db.prepare('UPDATE users SET total_xp = 0, level = 1, streak_days = 0 WHERE id = ?').run(userId);

  res.json({ message: '数据已重置' });
});

module.exports = router;
