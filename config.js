const fs = require('fs');
const path = require('path');

(function loadEnv() {
  try {
    const file = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    for (const raw of file.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
})();

module.exports = {
  LLM_API_KEY: process.env.LLM_API_KEY || '',
  LLM_BASE_URL: (process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, ''),
  LLM_MODEL: process.env.LLM_MODEL || 'deepseek-chat',
};
