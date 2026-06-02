const express = require('express');
const auth = require('../middleware/auth');
const { db, calcLevel, todayStr, yesterdayStr, weekStartStr } = require('../db');

const router = express.Router();

// GET /api/habits/logs — MUST be before /:id
router.get('/logs', auth, (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const userId = req.user.id;

  const rows = db.prepare(`
    SELECT checkin_date, COUNT(*) as count, SUM(xp_earned) as xp
    FROM habit_logs
    WHERE user_id = ?
      AND checkin_date >= date('now', ?)
    GROUP BY checkin_date
    ORDER BY checkin_date ASC
  `).all(userId, `-${days} days`);

  res.json(rows);
});

// GET /api/habits/stats — full bundle for stats page
router.get('/stats', auth, (req, res) => {
  const userId = req.user.id;
  const days = Math.min(parseInt(req.query.days) || 400, 800);

  const habits = db.prepare(`
    SELECT id, habit_name, frequency_type, frequency_count,
           date(created_at) as created_at
    FROM habits WHERE user_id = ?
    ORDER BY created_at ASC
  `).all(userId);

  const logs = db.prepare(`
    SELECT habit_id, checkin_date, xp_earned
    FROM habit_logs
    WHERE user_id = ? AND checkin_date >= date('now', ?)
    ORDER BY checkin_date ASC
  `).all(userId, `-${days} days`);

  const user = db.prepare(
    'SELECT username, total_xp, level, streak_days, role_id FROM users WHERE id = ?'
  ).get(userId);

  res.json({ habits, logs, user });
});

// GET /api/habits/logs/:date — per-day completion detail
router.get('/logs/:date', auth, (req, res) => {
  const userId = req.user.id;
  const date = req.params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: '日期格式无效' });
  }

  const rows = db.prepare(`
    SELECT h.id, h.habit_name, h.frequency_type, h.frequency_count,
      CASE WHEN hl.id IS NOT NULL THEN 1 ELSE 0 END as checked,
      COALESCE(hl.xp_earned, 0) as xp
    FROM habits h
    LEFT JOIN habit_logs hl
      ON hl.habit_id = h.id AND hl.user_id = ? AND hl.checkin_date = ?
    WHERE h.user_id = ?
      AND date(h.created_at) <= ?
    ORDER BY h.created_at ASC
  `).all(userId, date, userId, date);

  const totalXp = rows.reduce((s, r) => s + (r.xp || 0), 0);
  const done = rows.filter(r => r.checked).length;
  res.json({ date, habits: rows, total: rows.length, done, total_xp: totalXp });
});

// GET /api/habits
router.get('/', auth, (req, res) => {
  const userId = req.user.id;
  const today = todayStr();
  const weekStart = weekStartStr();

  const habits = db.prepare(`
    SELECT h.*,
      CASE WHEN hl.id IS NOT NULL THEN 1 ELSE 0 END as checked_today,
      (SELECT COUNT(*) FROM habit_logs wl
       WHERE wl.habit_id = h.id AND wl.user_id = ? AND wl.checkin_date >= ?) as week_count
    FROM habits h
    LEFT JOIN habit_logs hl
      ON hl.habit_id = h.id AND hl.user_id = ? AND hl.checkin_date = ?
    WHERE h.user_id = ?
    ORDER BY h.created_at ASC
  `).all(userId, weekStart, userId, today, userId);

  res.json(habits);
});

// POST /api/habits
router.post('/', auth, (req, res) => {
  const { habit_name, frequency_type, frequency_count } = req.body;
  const userId = req.user.id;

  if (!habit_name || !habit_name.trim()) {
    return res.status(400).json({ error: '习惯名称不能为空' });
  }
  if (!['daily', 'weekly'].includes(frequency_type)) {
    return res.status(400).json({ error: '频率类型无效' });
  }
  const count = parseInt(frequency_count) || 1;
  if (count < 1 || count > 7) {
    return res.status(400).json({ error: '频率次数需在1-7之间' });
  }

  const result = db.prepare(
    'INSERT INTO habits (user_id, habit_name, frequency_type, frequency_count) VALUES (?, ?, ?, ?)'
  ).run(userId, habit_name.trim(), frequency_type, count);

  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...habit, checked_today: 0, week_count: 0 });
});

// DELETE /api/habits/:id
router.delete('/:id', auth, (req, res) => {
  const userId = req.user.id;
  const habitId = parseInt(req.params.id);

  const habit = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').get(habitId, userId);
  if (!habit) {
    return res.status(404).json({ error: '习惯不存在' });
  }

  db.prepare('DELETE FROM habits WHERE id = ?').run(habitId);
  res.json({ message: '习惯已删除' });
});

// POST /api/habits/:id/checkin
router.post('/:id/checkin', auth, (req, res) => {
  const userId = req.user.id;
  const habitId = parseInt(req.params.id);
  const today = todayStr();
  const yesterday = yesterdayStr();

  const habit = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').get(habitId, userId);
  if (!habit) {
    return res.status(404).json({ error: '习惯不存在' });
  }

  const existing = db.prepare(
    'SELECT id FROM habit_logs WHERE habit_id = ? AND checkin_date = ?'
  ).get(habitId, today);
  if (existing) {
    return res.json({ alreadyCheckedIn: true, message: '今天已经打卡过了' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  // Streak logic
  const lastLog = db.prepare(
    'SELECT MAX(checkin_date) as last_date FROM habit_logs WHERE user_id = ?'
  ).get(userId);
  const lastDate = lastLog?.last_date;

  let newStreak = user.streak_days;
  if (!lastDate || lastDate < yesterday) {
    newStreak = 1;
  } else if (lastDate === yesterday) {
    newStreak = user.streak_days + 1;
  }
  // if lastDate === today, streak unchanged

  // XP calculation
  let xpEarned = 10;
  let bonusTriggered = false;
  if (newStreak > 0 && newStreak % 7 === 0) {
    xpEarned += 20;
    bonusTriggered = true;
  }

  db.prepare(
    'INSERT INTO habit_logs (habit_id, user_id, checkin_date, xp_earned) VALUES (?, ?, ?, ?)'
  ).run(habitId, userId, today, xpEarned);

  const newTotalXp = user.total_xp + xpEarned;
  const newLevel = calcLevel(newTotalXp);

  // Check all habits done today bonus
  const totalHabits = db.prepare('SELECT COUNT(*) as cnt FROM habits WHERE user_id = ?').get(userId).cnt;
  const doneToday = db.prepare(
    'SELECT COUNT(DISTINCT habit_id) as cnt FROM habit_logs WHERE user_id = ? AND checkin_date = ?'
  ).get(userId, today).cnt;

  let allDoneBonus = 0;
  if (totalHabits > 0 && doneToday >= totalHabits) {
    allDoneBonus = 15;
    bonusTriggered = true;
  }

  const finalXp = newTotalXp + allDoneBonus;
  const finalLevel = calcLevel(finalXp);

  db.prepare(
    'UPDATE users SET total_xp = ?, level = ?, streak_days = ? WHERE id = ?'
  ).run(finalXp, finalLevel, newStreak, userId);

  if (allDoneBonus > 0) {
    // Record bonus XP in a virtual log (attach to this habit)
    // We just add to total_xp above; no separate log needed
  }

  res.json({
    xp_earned: xpEarned + allDoneBonus,
    streak_days: newStreak,
    level: finalLevel,
    total_xp: finalXp,
    bonus_triggered: bonusTriggered,
    all_done_bonus: allDoneBonus > 0,
  });
});

module.exports = router;
