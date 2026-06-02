const config = require('./config');

async function chatComplete({ messages, temperature = 0.7, maxTokens = 800, timeoutMs = 25000 }) {
  if (!config.LLM_API_KEY) {
    const e = new Error('LLM_API_KEY not configured');
    e.code = 'NO_KEY';
    throw e;
  }
  const url = `${config.LLM_BASE_URL}/chat/completions`;
  const body = {
    model: config.LLM_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.LLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('LLM: empty content in response');
  }
  return content;
}

module.exports = { chatComplete };
