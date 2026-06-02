const express = require('express');
const auth = require('../middleware/auth');
const { db } = require('../db');
const { getReply } = require('../ai-responses');
const { analyzeMessage } = require('../ai-planner');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const userId = req.user.id;
  const messages = db.prepare(
    'SELECT id, role, content, created_at FROM conversations WHERE user_id = ? ORDER BY created_at ASC LIMIT 50'
  ).all(userId);
  res.json(messages);
});

router.post('/', auth, async (req, res, next) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: '消息不能为空' });
    }
    if (content.length > 500) {
      return res.status(400).json({ error: '消息过长' });
    }

    const trimmed = content.trim();

    const userMsg = db.prepare(
      'INSERT INTO conversations (user_id, role, content) VALUES (?, ?, ?)'
    ).run(userId, 'user', trimmed);

    const user = db.prepare('SELECT role_id, total_xp, level, streak_days FROM users WHERE id = ?').get(userId);

    if (!user.role_id) {
      const noRoleReply = '你还没有选择专属伙伴哦～快去性格测试页面找到你的AI分身吧！';
      const assistantMsg = db.prepare(
        'INSERT INTO conversations (user_id, role, content) VALUES (?, ?, ?)'
      ).run(userId, 'assistant', noRoleReply);

      return res.json({
        userMessage: { id: userMsg.lastInsertRowid, role: 'user', content: trimmed },
        assistantMessage: { id: assistantMsg.lastInsertRowid, role: 'assistant', content: noRoleReply },
        extractedPlans: [],
        suggestions: [],
      });
    }

    const existingHabits = db.prepare('SELECT habit_name FROM habits WHERE user_id = ?').all(userId);
    const ai = await analyzeMessage({
      message: trimmed,
      existingHabits,
      user,
    });

    const reply = (ai.reply && ai.reply.length > 0) ? ai.reply : getReply(user.role_id, trimmed, user);
    const assistantMsg = db.prepare(
      'INSERT INTO conversations (user_id, role, content) VALUES (?, ?, ?)'
    ).run(userId, 'assistant', reply);

    res.json({
      userMessage: { id: userMsg.lastInsertRowid, role: 'user', content: trimmed },
      assistantMessage: { id: assistantMsg.lastInsertRowid, role: 'assistant', content: reply },
      extractedPlans: ai.extractedPlans,
      suggestions: ai.suggestions,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
