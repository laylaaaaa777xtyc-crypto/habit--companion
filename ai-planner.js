// ============================================================
// AI Planner — drives chat reply + plan extraction + suggestions.
//
// Public contract:
//   analyzeMessage({ message, existingHabits, user })
//     -> { reply: string, extractedPlans: Plan[], suggestions: string[] }
//
//   Plan = { habit_name: string, frequency_type: 'daily'|'weekly', frequency_count: number(1-7) }
//
// Primary path: OpenAI-compatible LLM chat-completion call (DeepSeek by
// default; switch via .env LLM_BASE_URL / LLM_MODEL).
// Fallback: rule-based regex stub if the API call fails (no key, network,
// malformed JSON, etc.) — chat keeps working either way.
// ============================================================

const config = require('./config');
const { chatComplete } = require('./llm-client');

const CHARACTER_PROMPT = {
  1: { name: '学者猫', title: '理性分析派', tone: '冷静博学，常用"根据计划分析……"开头，用数据和逻辑讲话，不情绪化。' },
  2: { name: '勇者犬', title: '行动力派', tone: '充满活力，热血斗志，常说"冲啊！"，鼓动用户立刻行动。' },
  3: { name: '精灵鹿', title: '温柔治愈派', tone: '温和体贴，从不催促，给人温暖的鼓励，语气柔软。' },
  4: { name: '机械龙', title: '效率数据派', tone: '工程师式精准语言，把行为量化，常给出数据/优化建议。' },
  5: { name: '小幽灵', title: '轻松随意派', tone: '可爱随性，常说"今天不想动？那就休息一下呗～"，不给压力。' },
};


const INTENT = /我想|我要|打算|计划|决定|准备|想要|希望|坚持|开始|养成|每天|每日|每周/;

const HABIT_HINTS = /(读书|阅读|看书|背单词|学英语|学习|写代码|编程|刷题|跑步|快走|散步|运动|健身|锻炼|游泳|骑车|喝水|早睡|早起|睡觉|冥想|瑜伽|拉伸|写日记|记账|画画|练琴|做饭|早餐|打扫|整理|护肤|做家务|看新闻)/g;

const UNIT_TAIL = /^[\s\d一二三四五六七八九十百]{0,5}(分钟|小时|页|公里|千米|km|个|次|节|遍|杯|组|轮)/;

const CN_NUM = { '一':1,'两':2,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7 };

function parseChineseNumber(raw) {
  if (raw == null) return null;
  if (CN_NUM[raw] != null) return CN_NUM[raw];
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function detectFrequency(seg) {
  const isWeekly = /每周|每星期|每个礼拜/.test(seg);
  if (isWeekly) {
    const m = seg.match(/([1-7]|[一二三四五六七])\s*次/);
    const n = m ? Math.min(7, Math.max(1, parseChineseNumber(m[1]) || 3)) : 3;
    return { frequency_type: 'weekly', frequency_count: n };
  }
  if (/每天|每日|日常/.test(seg)) return { frequency_type: 'daily', frequency_count: 1 };
  return null;
}

function buildHabitName(seg, hint, isWeekly) {
  const i = seg.indexOf(hint);
  if (i < 0) return hint;
  const tail = seg.slice(i + hint.length, i + hint.length + 12);
  const m = tail.match(UNIT_TAIL);
  // If seg is weekly, "X次" is the frequency count, not part of the habit name.
  if (m && !(isWeekly && /次$/.test(m[0]))) {
    return (hint + m[0]).replace(/\s+/g, '');
  }
  return hint;
}

function parseSegment(seg) {
  if (!seg) return null;
  const freq = detectFrequency(seg);
  HABIT_HINTS.lastIndex = 0;
  const hints = [...seg.matchAll(HABIT_HINTS)].map(m => m[0]);

  if (hints.length === 0) {
    if (!freq || !INTENT.test(seg)) return null;
    const stripped = seg
      .replace(/^.*?(我想|我要|打算|计划|决定|准备|想要|希望|坚持|开始|养成)/, '')
      .replace(/^(每天|每日|日常|每周\s*[1-7一二三四五六七]?\s*次?|每星期|每个礼拜)/, '')
      .trim();
    if (!stripped || stripped.length > 16) return null;
    return { habit_name: stripped, ...freq };
  }

  return {
    habit_name: buildHabitName(seg, hints[0], freq && freq.frequency_type === 'weekly'),
    frequency_type: freq ? freq.frequency_type : 'daily',
    frequency_count: freq ? freq.frequency_count : 1,
  };
}

function extractPlans(message) {
  const text = (message || '').trim();
  if (!text) return [];
  if (!INTENT.test(text) && !HABIT_HINTS.test(text)) return [];

  const parts = text.split(/[，,。、；;\n！!？?]/).map(s => s.trim()).filter(Boolean);
  const plans = [];
  for (const part of parts) {
    const p = parseSegment(part);
    if (p) plans.push(p);
  }

  const seen = new Set();
  return plans.filter(p => {
    const k = `${p.habit_name}|${p.frequency_type}|${p.frequency_count}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function generateSuggestions(plans, existingHabits) {
  const suggestions = [];
  const existing = (existingHabits || []).map(h => h.habit_name || '');
  if (!plans || plans.length === 0) return suggestions;

  const dups = plans.filter(p => existing.some(name => name.includes(p.habit_name) || p.habit_name.includes(name)));
  if (dups.length > 0) {
    suggestions.push(`你已经有「${dups[0].habit_name}」类似的计划啦，可以先专注完成已有的，避免重复～`);
  }

  if (existing.length + plans.length > 5) {
    suggestions.push('一次别加太多哦～建议先聚焦 3-5 个最重要的习惯，等坚持稳定后再加新的。');
  }

  if (plans.some(p => /(跑步|运动|健身|锻炼)/.test(p.habit_name))) {
    suggestions.push('运动类习惯前几次别追求强度，先把"换衣服出门"这一步固化为身体记忆。');
  }
  if (plans.some(p => /(读书|阅读|看书)/.test(p.habit_name)) && !plans.some(p => /分钟|页/.test(p.habit_name))) {
    suggestions.push('阅读建议设定具体时长或页数（如"读 10 页"），比"读书"更容易判定完成。');
  }
  if (plans.some(p => /(早睡|睡觉)/.test(p.habit_name))) {
    suggestions.push('早睡习惯的关键是睡前 30 分钟放下手机，而不是更早躺到床上。');
  }
  if (plans.some(p => /(冥想|瑜伽|拉伸)/.test(p.habit_name))) {
    suggestions.push('冥想/拉伸建议绑定到固定动作，比如"刷牙后立刻冥想 3 分钟"。');
  }

  if (suggestions.length === 0) {
    suggestions.push('小贴士：把习惯绑定到固定的时间或场景（如"早餐后"），比单纯靠意志力坚持更靠谱。');
  }
  return suggestions.slice(0, 3);
}

function buildSystemPrompt({ char, user, existingHabits }) {
  const habitsList = (existingHabits || [])
    .map(h => `- ${h.habit_name}`)
    .join('\n') || '（暂无）';
  return `你是一个习惯打卡 App 中的 AI 伙伴，名字是「${char.name}」，性格是【${char.title}】。
说话风格：${char.tone}

用户当前数据：等级 Lv.${user.level || 1}，连续打卡 ${user.streak_days || 0} 天，总 XP ${user.total_xp || 0}。
用户已有的习惯：
${habitsList}

请阅读用户消息，并执行以下任务：
1. 用「${char.name}」的口吻回复，简短自然（30-80 字），符合角色性格。
2. 如果用户消息中明确表达了想要养成/坚持的新习惯（例如"我想每天读书"、"打算每周跑步3次"），请将其提取为结构化 plan。
3. 如果有提取到 plan，给 1-2 条针对性的优化建议。没有就给空数组。
4. 如果用户只是闲聊、查询进度或表达情绪，不要硬提取 plan（extractedPlans 留空数组）。
5. 不要重复用户已有的习惯。

严格输出以下 JSON（不要 markdown 代码块、不要任何额外文字）：
{
  "reply": "你的对话回复",
  "extractedPlans": [
    { "habit_name": "习惯名（4-15 字，简洁明确）", "frequency_type": "daily" 或 "weekly", "frequency_count": 1-7 的整数 }
  ],
  "suggestions": ["建议1", "建议2"]
}`;
}

function tryParseJson(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  return null;
}

function sanitizePlans(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(p => p && typeof p.habit_name === 'string' && p.habit_name.trim().length > 0)
    .map(p => ({
      habit_name: p.habit_name.trim().slice(0, 30),
      frequency_type: p.frequency_type === 'weekly' ? 'weekly' : 'daily',
      frequency_count: Math.min(7, Math.max(1, parseInt(p.frequency_count, 10) || 1)),
    }))
    .slice(0, 5);
}

function sanitizeSuggestions(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(s => typeof s === 'string' && s.trim().length > 0)
    .map(s => s.trim().slice(0, 120))
    .slice(0, 3);
}

function localFallback(message, existingHabits) {
  const extractedPlans = extractPlans(message);
  const suggestions = generateSuggestions(extractedPlans, existingHabits);
  return { reply: '', extractedPlans, suggestions };
}

async function analyzeMessage({ message, existingHabits, user }) {
  const char = CHARACTER_PROMPT[user && user.role_id] || CHARACTER_PROMPT[1];

  if (!config.LLM_API_KEY) {
    return localFallback(message, existingHabits);
  }

  try {
    const raw = await chatComplete({
      messages: [
        { role: 'system', content: buildSystemPrompt({ char, user: user || {}, existingHabits }) },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      maxTokens: 600,
    });
    const parsed = tryParseJson(raw);
    if (!parsed) {
      console.error('[ai-planner] MiniMax returned non-JSON:', raw.slice(0, 200));
      const fb = localFallback(message, existingHabits);
      return { ...fb, reply: typeof raw === 'string' ? raw.trim().slice(0, 300) : '' };
    }
    return {
      reply: typeof parsed.reply === 'string' ? parsed.reply.trim() : '',
      extractedPlans: sanitizePlans(parsed.extractedPlans),
      suggestions: sanitizeSuggestions(parsed.suggestions),
    };
  } catch (err) {
    console.error('[ai-planner] MiniMax call failed:', err.message);
    return localFallback(message, existingHabits);
  }
}

module.exports = { analyzeMessage, extractPlans, generateSuggestions };
