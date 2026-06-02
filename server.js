require('./db'); // initialize database first

const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());

// Disable static file cache during development so browser always sees latest
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { etag: false, lastModified: false }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/habits', require('./routes/habits'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/user', require('./routes/users'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌟 AI习惯伙伴已启动: http://localhost:${PORT}`);
});
