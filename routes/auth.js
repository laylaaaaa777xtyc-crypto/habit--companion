const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username.length < 2 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度需在2-20字符之间' });
  }
  if (!/^[a-zA-Z0-9_一-龥]+$/.test(username)) {
    return res.status(400).json({ error: '用户名只能包含字母、数字、下划线或中文' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少需要6位' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: '该用户名已被使用' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password) VALUES (?, ?)'
  ).run(username, hashed);

  const userId = result.lastInsertRowid;
  const token = jwt.sign({ id: userId, username, role_id: null }, JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({
    token,
    user: { id: userId, username, role_id: null, level: 1, total_xp: 0, streak_days: 0 }
  });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role_id: user.role_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role_id: user.role_id,
      level: user.level,
      total_xp: user.total_xp,
      streak_days: user.streak_days,
    }
  });
});

module.exports = router;
