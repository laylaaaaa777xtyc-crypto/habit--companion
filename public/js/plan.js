// Auth guard
if (!getToken()) window.location.href = '/index.html';

// ============ HERO 3D VIDEO — chroma-key (edge flood-fill) for true transparency ============
// Per-character crop and chroma thresholds are set by applyHero3D(); tick() reads them each frame.
let heroCrop = { x: 0.10, y: 0.04, w: 0.82, h: 0.92 };
let heroChroma = { whiteThreshold: 232, edgeSoftThreshold: 200 };

function setupHero3D() {
  const video = document.getElementById('hero-3d-video');
  const canvas = document.getElementById('hero-3d-canvas');
  if (!video || !canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Slow down the talking speed so the character speaks at a calmer pace
  video.playbackRate = 0.55;

  function isWhitish(d, p, threshold) {
    return d[p] > threshold && d[p+1] > threshold && d[p+2] > threshold;
  }

  function tick() {
    if (video.readyState >= 2 && !video.paused && !video.ended) {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (vw && vh) {
        const cropX = vw * heroCrop.x;
        const cropY = vh * heroCrop.y;
        const cropW = vw * heroCrop.w;
        const cropH = vh * heroCrop.h;
        const w = Math.round(cropW), h = Math.round(cropH);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w; canvas.height = h;
        }
        // Pre-keyed WebM already has correct alpha — draw directly, skip chroma-key.
        if (heroChroma.preKeyed) {
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, w, h);
          requestAnimationFrame(tick);
          return;
        }

        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, w, h);
        const frame = ctx.getImageData(0, 0, w, h);
        const d = frame.data;
        const n = w * h;
        const whiteT = heroChroma.whiteThreshold;
        const softT = heroChroma.edgeSoftThreshold;

        // 1) Flood fill from all edges through whitish pixels — only connected
        //    background gets marked, internal white (cat face) stays opaque.
        const bg = new Uint8Array(n);
        const stack = new Int32Array(n);
        let sp = 0;

        function pushIfWhite(idx) {
          if (!bg[idx] && isWhitish(d, idx * 4, whiteT)) {
            bg[idx] = 1;
            stack[sp++] = idx;
          }
        }

        for (let x = 0; x < w; x++) {
          pushIfWhite(x);
          pushIfWhite((h - 1) * w + x);
        }
        for (let y = 0; y < h; y++) {
          pushIfWhite(y * w);
          pushIfWhite(y * w + (w - 1));
        }

        while (sp > 0) {
          const idx = stack[--sp];
          const x = idx % w;
          const y = (idx / w) | 0;
          if (x > 0)     pushIfWhite(idx - 1);
          if (x < w - 1) pushIfWhite(idx + 1);
          if (y > 0)     pushIfWhite(idx - w);
          if (y < h - 1) pushIfWhite(idx + w);
        }

        // 2) Apply mask + soften edge halo
        for (let i = 0; i < n; i++) {
          const p = i * 4;
          if (bg[i]) {
            d[p + 3] = 0;
          } else {
            const r = d[p], g = d[p+1], b = d[p+2];
            const minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
            if (minC > softT) {
              const x = i % w;
              const y = (i / w) | 0;
              let nearBg = false;
              if (x > 0     && bg[i - 1])  nearBg = true;
              else if (x < w-1 && bg[i + 1]) nearBg = true;
              else if (y > 0     && bg[i - w]) nearBg = true;
              else if (y < h-1 && bg[i + w]) nearBg = true;
              if (nearBg) {
                d[p + 3] = Math.max(0, (whiteT - minC) * 8);
              }
            }
          }
        }

        ctx.putImageData(frame, 0, 0);
      }
    }
    requestAnimationFrame(tick);
  }
  tick();
  video.play().catch(() => {});
}
document.addEventListener('DOMContentLoaded', setupHero3D);

// ============ CHARACTER DATA ============
const CHARACTER_META = {
  1: {
    name: '学者猫', emoji: '🐱', title: '理性分析派',
    quote: '根据计划分析…', paw: '🐾',
    img: { full: '/img/scholar-cat-full.png', avatar: '/img/scholar-cat-avatar.png' },
    video: '/video/hero-3d.mp4',
    videoCrop: { x: 0.10, y: 0.04, w: 0.82, h: 0.92 }
  },
  2: {
    name: '勇者犬', emoji: '🐶', title: '行动力派',
    quote: '冲啊，今天战胜拖延！', paw: '🦴',
    img: { full: '/img/brave-dog-full.png', avatar: '/img/brave-dog-avatar.png' },
    video: '/video/brave-dog-3d.mp4',
    videoCrop: { x: 0.15, y: 0.06, w: 0.70, h: 0.90 },
    // Background is a light-gray gradient (top ~231, bottom ~240) — not pure white.
    // Default threshold 232 misses the top band; lower to 225 to fully strip it.
    videoChroma: { whiteThreshold: 225, edgeSoftThreshold: 212 }
  },
  3: {
    name: '精灵鹿', emoji: '🦌', title: '温柔治愈派',
    quote: '慢慢来，你已经很棒了', paw: '🌿',
    img: { full: '/img/spirit-deer-full.png', avatar: '/img/spirit-deer-avatar.png' },
    video: '/video/spirit-deer-3d.mp4',
    videoCrop: { x: 0.18, y: 0.02, w: 0.66, h: 0.96 },
    // Face/fur has near-white tones that leaked to the edge background via the
    // default 232 threshold, leaving a hollow face. Only strip near-pure white.
    videoChroma: { whiteThreshold: 250, edgeSoftThreshold: 240 }
  },
  4: {
    name: '机械龙', emoji: '🐉', title: '效率数据派',
    quote: '效率提升中，继续保持', paw: '⚙️',
    img: { full: '/img/mecha-dragon-full.png', avatar: '/img/mecha-dragon-avatar.png' },
    video: '/video/mecha-dragon-3d.mp4',
    videoCrop: { x: 0.06, y: 0.02, w: 0.88, h: 0.95 }
  },
  5: {
    name: '小幽灵', emoji: '👻', title: '轻松随意派',
    quote: '今天不想动？休息呗～', paw: '✨',
    img: { full: '/img/ghostie-full.png', avatar: '/img/ghostie-avatar.png' },
    video: '/video/ghostie-3d.mp4',
    videoCrop: { x: 0.18, y: 0.08, w: 0.64, h: 0.84 },
    // Ghostie body is mostly white — only strip pixels that are *nearly pure*
    // white, otherwise the flood fill would erase the character itself.
    videoChroma: { whiteThreshold: 240, edgeSoftThreshold: 225 }
  },
};

// Swap the hero 3D <video> src to match the selected character. If the
// character has no video file, fall back to the static full-body image.
function applyHero3D(roleId) {
  const meta = CHARACTER_META[roleId];
  const container = document.getElementById('character-3d');
  const video = document.getElementById('hero-3d-video');
  const canvas = document.getElementById('hero-3d-canvas');
  if (!container || !video || !canvas) return;

  if (meta && meta.video) {
    if (meta.videoCrop) heroCrop = meta.videoCrop;
    // Reset chroma thresholds, then apply per-character override if any.
    heroChroma = { whiteThreshold: 232, edgeSoftThreshold: 200 };
    if (meta.videoChroma) heroChroma = { ...heroChroma, ...meta.videoChroma };
    video.style.display = '';
    canvas.style.display = '';
    const fallback = container.querySelector('.hero-3d-fallback-img');
    if (fallback) fallback.remove();

    const sourceType = meta.videoType || 'video/mp4';
    const source = video.querySelector('source');
    if (!source || source.getAttribute('src') !== meta.video) {
      if (source) {
        source.setAttribute('src', meta.video);
        source.setAttribute('type', sourceType);
      } else {
        const s = document.createElement('source');
        s.setAttribute('src', meta.video);
        s.setAttribute('type', sourceType);
        video.appendChild(s);
      }
      video.load();
      video.playbackRate = 0.55;
      video.play().catch(() => {});
    }
  } else {
    video.style.display = 'none';
    canvas.style.display = 'none';
    let img = container.querySelector('.hero-3d-fallback-img');
    if (!img) {
      img = document.createElement('img');
      img.className = 'hero-3d-fallback-img';
      container.appendChild(img);
    }
    if (meta && meta.img && meta.img.full) {
      img.src = meta.img.full;
      img.alt = meta.name;
    }
  }
}

// Render character into a container — uses image if available, else emoji fallback
function renderChar(el, roleId, type = 'avatar') {
  const c = CHARACTER_META[roleId];
  if (!c) { el.textContent = '🌟'; return; }
  if (c.img && c.img[type]) {
    el.innerHTML = `<img src="${c.img[type]}" alt="${c.name}" class="char-img" />`;
  } else {
    el.textContent = c.emoji;
  }
}

const HABIT_ICON_MAP = [
  { kw: /读|书|阅|学习/,         icon: '📚', cls: 'icon-blue' },
  { kw: /跑|步|运动|健身|锻炼/, icon: '🏃', cls: 'icon-orange' },
  { kw: /编程|代码|coding|写代码/i, icon: '💻', cls: 'icon-purple' },
  { kw: /喝水|水/,             icon: '💧', cls: 'icon-blue' },
  { kw: /睡|休息|早睡/,         icon: '😴', cls: 'icon-purple' },
  { kw: /冥想|瑜伽|静坐/,       icon: '🧘', cls: 'icon-green' },
  { kw: /写|日记|记录/,         icon: '✍️', cls: 'icon-yellow' },
  { kw: /英语|单词|语言/,       icon: '🔤', cls: 'icon-pink' },
  { kw: /画|画画|绘/,           icon: '🎨', cls: 'icon-pink' },
  { kw: /音乐|乐器|琴|唱/,      icon: '🎵', cls: 'icon-purple' },
  { kw: /做饭|烹饪|早餐/,       icon: '🍳', cls: 'icon-yellow' },
  { kw: /整理|打扫|清洁/,       icon: '🧹', cls: 'icon-green' },
];

function getHabitIcon(name) {
  for (const m of HABIT_ICON_MAP) if (m.kw.test(name)) return m;
  return { icon: '🌱', cls: 'icon-green' };
}

// ============ STATE ============
let currentProfile = null;
let currentHabits = [];
let calMonth = new Date();
let logsByDate = {};

// ============ TOP HEADER (greeting / date / motto) ============
function updateGreeting() {
  const now = new Date();
  const h = now.getHours();
  let prefix = '早上好';
  let motto = '元气满满地开始今天吧';
  if (h >= 6 && h < 12) { prefix = '早上好'; motto = '清晨的阳光，是给坚持者的奖励'; }
  else if (h >= 12 && h < 14) { prefix = '中午好'; motto = '小憩一下，下午继续加油'; }
  else if (h >= 14 && h < 18) { prefix = '下午好'; motto = '每一个小步伐，都在塑造更好的你'; }
  else if (h >= 18 && h < 22) { prefix = '晚上好'; motto = '今天的努力，明天的底气' ; }
  else { prefix = '夜深了'; motto = '记得早点休息，明天会更好'; }
  document.getElementById('greeting-prefix').textContent = prefix;
  document.getElementById('motto-text').textContent = motto;

  const days = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  document.getElementById('current-date').textContent =
    `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 · ${days[now.getDay()]}`;
}

// ============ SIDEBAR / CHARACTER UI ============
function applyCharacter(user) {
  const char = CHARACTER_META[user.role_id] || { name: '伙伴', emoji: '🌟', title: '', quote: '一起加油吧' };

  renderChar(document.getElementById('sb-avatar'), user.role_id, 'avatar');
  applyHero3D(user.role_id);
  renderChar(document.getElementById('chat-header-avatar'), user.role_id, 'avatar');
  renderChar(document.getElementById('chat-welcome-emoji'), user.role_id, 'avatar');

  // Streak decoration: prefer avatar img if available
  const streakEl = document.getElementById('streak-decor');
  if (char.img && char.img.avatar) {
    streakEl.innerHTML = `<img src="${char.img.avatar}" alt="${char.name}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;box-shadow:0 4px 10px rgba(0,0,0,0.1)" />`;
  } else {
    streakEl.textContent = char.emoji;
  }

  document.getElementById('sb-name').textContent = char.name;
  document.getElementById('sb-quote').textContent = char.quote;
  document.getElementById('ai-watermark').textContent = char.paw;
  document.getElementById('chat-header-name').textContent = char.name;
  document.getElementById('chat-header-tag').textContent = char.title;
  document.getElementById('user-name').textContent = user.username || '朋友';
}

function applyAiGreeting(user) {
  const char = CHARACTER_META[user.role_id];
  if (!char) return;
  const total = currentHabits.length;
  const done = currentHabits.filter(h => h.checked_today).length;
  let msg = '';
  if (total === 0) {
    msg = '先添加一个小习惯吧！哪怕只是「喝一杯水」也算开始～';
  } else if (done === 0) {
    const greetings = {
      1: '根据计划分析……今天有 {total} 个任务待完成，建议从最容易的开始。',
      2: '冲啊！今天有 {total} 个任务，一个一个击破它们！',
      3: '慢慢来，你已经很棒了。今天有 {total} 件小事，按你的节奏走就好～',
      4: '今日任务队列：{total}。建议优先级排序后逐项执行。',
      5: '今天有 {total} 件事呢～不想动？那就先休息一下也行～',
    };
    msg = greetings[user.role_id].replace('{total}', total);
  } else if (done < total) {
    const mid = {
      1: '已完成 {done}/{total}，进度良好，继续保持节奏。',
      2: '冲啊！已经搞定 {done} 个了，剩下的不在话下！',
      3: '已经完成 {done} 个了，慢慢来，剩下的也会顺利的～',
      4: '完成率 {pct}%，继续保持。',
      5: '搞定 {done} 个啦！剩下的随缘～嘻嘻',
    };
    const pct = Math.round((done/total)*100);
    msg = mid[user.role_id].replace('{done}', done).replace('{total}', total).replace('{pct}', pct);
  } else {
    const done_all = {
      1: '根据计划分析……今日所有任务已完成。这是高效执行的典型案例。',
      2: '全部完成！今天的你就是无敌的！冲啊！',
      3: '全做完了呢～慢慢来的你今天又超棒！',
      4: '今日执行率 100%。系统评分：完美。',
      5: '全做完了诶！小幽灵都惊呆了～',
    };
    msg = done_all[user.role_id];
  }
  document.getElementById('ai-greeting').textContent = msg;

  // Progress
  const pct = total > 0 ? Math.round((done/total)*100) : 0;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('progress-text').textContent = `${done}/${total}`;
}

// ============ HABITS ============
async function loadHabits() {
  currentHabits = await api.get('/habits');
  renderHabits();
}

function renderHabits() {
  const list = document.getElementById('habit-list');
  const empty = document.getElementById('habits-empty');
  list.innerHTML = '';
  if (!currentHabits || currentHabits.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  currentHabits.forEach((h, idx) => {
    const ico = getHabitIcon(h.habit_name);
    const li = document.createElement('li');
    li.className = `plan-item${h.checked_today ? ' checked' : ''}`;
    let freqLabel = h.frequency_type === 'daily' ? '每天' : `每周 ${h.frequency_count} 次（已完成 ${h.week_count}/${h.frequency_count}）`;
    // Auto-generated suggested time slot based on index
    const timeSlots = ['08:00','09:30','12:00','15:00','18:00','20:30','22:00'];
    const time = timeSlots[idx % timeSlots.length];

    li.innerHTML = `
      <div class="plan-item-icon ${ico.cls}">${ico.icon}</div>
      <div class="plan-item-info">
        <div class="plan-item-name">${escapeHtml(h.habit_name)}</div>
        <div class="plan-item-meta">${freqLabel}</div>
      </div>
      <div class="plan-item-time">${time}</div>
      <button class="btn-checkin${h.checked_today ? ' done' : ''}" data-id="${h.id}" ${h.checked_today ? 'disabled' : ''}>${h.checked_today ? '✓' : ''}</button>
      <button class="btn-delete-habit" data-id="${h.id}" title="删除">🗑</button>
    `;
    const checkinBtn = li.querySelector('.btn-checkin');
    if (!h.checked_today) checkinBtn.addEventListener('click', () => handleCheckin(h.id));
    li.querySelector('.btn-delete-habit').addEventListener('click', () => handleDeleteHabit(h.id, h.habit_name));
    list.appendChild(li);
  });
}

async function handleCheckin(habitId) {
  try {
    const result = await api.post(`/habits/${habitId}/checkin`, {});
    if (result.alreadyCheckedIn) { showToast('今天已经打卡过了 ✅'); return; }

    let msg = `+${result.xp_earned} XP 🎉`;
    if (result.bonus_triggered) {
      msg = result.all_done_bonus
        ? `全部完成！+${result.xp_earned} XP 🏆`
        : `连击奖励！+${result.xp_earned} XP 🔥`;
    }
    showToast(msg);
    await Promise.all([loadProfile(), loadHabits(), loadCalendar(), loadStats()]);
    applyAiGreeting(currentProfile);
  } catch (err) {
    showToast(err.message || '打卡失败');
  }
}

async function handleDeleteHabit(habitId, name) {
  if (!confirm(`确定删除「${name}」吗？打卡记录也会一并删除。`)) return;
  try {
    await api.delete(`/habits/${habitId}`);
    await Promise.all([loadHabits(), loadProfile(), loadStats()]);
    applyAiGreeting(currentProfile);
  } catch (err) { alert(err.message); }
}

// ============ ADD HABIT MODAL ============
const modalAdd = document.getElementById('modal-add-habit');
document.getElementById('btn-add-habit').addEventListener('click', () => {
  modalAdd.classList.remove('hidden');
  document.getElementById('habit-name-input').value = '';
  document.getElementById('weekly-count-group').classList.add('hidden');
  document.querySelector('[name="freq-type"][value="daily"]').checked = true;
  setTimeout(() => document.getElementById('habit-name-input').focus(), 50);
});
document.getElementById('btn-cancel-habit').addEventListener('click', () => modalAdd.classList.add('hidden'));
modalAdd.addEventListener('click', (e) => { if (e.target === modalAdd) modalAdd.classList.add('hidden'); });
document.querySelectorAll('[name="freq-type"]').forEach(r => {
  r.addEventListener('change', () => {
    const wk = document.getElementById('weekly-count-group');
    if (r.value === 'weekly' && r.checked) wk.classList.remove('hidden');
    else if (r.value === 'daily' && r.checked) wk.classList.add('hidden');
  });
});
document.getElementById('btn-save-habit').addEventListener('click', async () => {
  const name = document.getElementById('habit-name-input').value.trim();
  const freqType = document.querySelector('[name="freq-type"]:checked').value;
  const freqCount = parseInt(document.getElementById('freq-count').value) || 1;
  if (!name) return document.getElementById('habit-name-input').focus();

  const btn = document.getElementById('btn-save-habit');
  btn.disabled = true; btn.textContent = '保存中…';
  try {
    await api.post('/habits', { habit_name: name, frequency_type: freqType, frequency_count: freqCount });
    modalAdd.classList.add('hidden');
    await Promise.all([loadHabits(), loadProfile()]);
    applyAiGreeting(currentProfile);
  } catch (err) { alert(err.message); }
  finally { btn.disabled = false; btn.textContent = '保存'; }
});

// ============ PROFILE ============
async function loadProfile() {
  currentProfile = await api.get('/user/profile');
  applyCharacter(currentProfile);
  document.getElementById('streak-days-num').textContent = currentProfile.streak_days;

  const sd = currentProfile.streak_days;
  let m = '开始你的旅程吧！';
  if (sd >= 30) m = '太厉害了！习惯达人！';
  else if (sd >= 14) m = '势如破竹！';
  else if (sd >= 7) m = '一周连续，了不起！';
  else if (sd >= 3) m = '再接再厉！';
  else if (sd >= 1) m = '好的开始！';
  document.getElementById('streak-msg').textContent = m;
}

// ============ AVATAR & PLAN PREVIEW (explore card) ============
function renderAvatarRow() {
  const row = document.getElementById('avatar-row');
  row.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const c = CHARACTER_META[i];
    const div = document.createElement('div');
    div.className = `avatar-mini${currentProfile && currentProfile.role_id === i ? ' current' : ''}`;
    const img = c.img && c.img.avatar
      ? `<img src="${c.img.avatar}" alt="${c.name}" style="width:34px;height:34px;border-radius:50%;object-fit:cover" />`
      : `<div class="avatar-mini-emoji">${c.emoji}</div>`;
    div.innerHTML = `${img}<div class="avatar-mini-name">${c.name}</div>`;
    div.addEventListener('click', () => { window.location.href = '/choose-character.html'; });
    row.appendChild(div);
  }
}

function renderPlanPreview() {
  const wrap = document.getElementById('plan-preview');
  wrap.innerHTML = '';
  if (currentHabits.length === 0) {
    wrap.innerHTML = '<div style="text-align:center;padding:8px;color:var(--text-light);font-size:0.78rem">暂无计划</div>';
    return;
  }
  currentHabits.slice(0, 3).forEach(h => {
    const isWeekly = h.frequency_type === 'weekly';
    const pct = isWeekly
      ? Math.min(100, Math.round((h.week_count / h.frequency_count) * 100))
      : (h.checked_today ? 100 : 0);
    const tag = h.checked_today || (isWeekly && h.week_count >= h.frequency_count) ? 'tag-done' : 'tag-active';
    const tagText = (h.checked_today || (isWeekly && h.week_count >= h.frequency_count)) ? '已完成' : '进行中';
    const row = document.createElement('div');
    row.className = 'plan-preview-row';
    row.innerHTML = `
      <span class="plan-preview-tag ${tag}">${tagText}</span>
      <span class="plan-preview-name">${escapeHtml(h.habit_name)}</span>
      <div class="plan-preview-bar"><div class="plan-preview-bar-fill" style="width:${pct}%"></div></div>
    `;
    wrap.appendChild(row);
  });
}

// ============ CALENDAR ============
async function loadCalendar() {
  try {
    // Fetch full month logs (use 31 days as upper bound)
    const logs = await api.get('/habits/logs?days=62');
    logsByDate = {};
    logs.forEach(l => { logsByDate[l.checkin_date] = l.count; });
  } catch {}
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  const title = document.getElementById('cal-title');
  grid.innerHTML = '';
  const y = calMonth.getFullYear();
  const m = calMonth.getMonth();
  title.textContent = `${y}年${m+1}月`;

  ['日','一','二','三','四','五','六'].forEach(d => {
    const w = document.createElement('div');
    w.className = 'cal-weekday';
    w.textContent = d;
    grid.appendChild(w);
  });

  const firstDay = new Date(y, m, 1).getDay();
  const lastDate = new Date(y, m+1, 0).getDate();
  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement('div'); e.className = 'cal-day empty'; grid.appendChild(e);
  }
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  for (let d = 1; d <= lastDate; d++) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell = document.createElement('div');
    let cls = 'cal-day';
    if (dateStr === todayStr) cls += ' today';
    if (logsByDate[dateStr]) cls += ' checked';
    if (dateStr > todayStr) cls += ' future';
    cell.className = cls;
    cell.textContent = d;
    if (dateStr <= todayStr) {
      cell.addEventListener('click', () => openDayDetail(dateStr));
    }
    grid.appendChild(cell);
  }
}

// ============ DAY DETAIL MODAL ============
const modalDayDetail = document.getElementById('modal-day-detail');

async function openDayDetail(dateStr) {
  const titleEl = document.getElementById('day-detail-title');
  const summaryEl = document.getElementById('day-detail-summary');
  const listEl = document.getElementById('day-detail-list');
  const emptyEl = document.getElementById('day-detail-empty');

  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  const days = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  titleEl.textContent = `${y}年${m}月${d}日 · ${days[dt.getDay()]}`;
  summaryEl.textContent = '加载中…';
  listEl.innerHTML = '';
  emptyEl.classList.add('hidden');
  modalDayDetail.classList.remove('hidden');

  try {
    const data = await api.get(`/habits/logs/${dateStr}`);
    if (!data.habits || data.habits.length === 0) {
      summaryEl.textContent = '';
      emptyEl.classList.remove('hidden');
      return;
    }
    const pct = Math.round((data.done / data.total) * 100);
    summaryEl.innerHTML = `
      <div class="day-detail-stats">
        <span class="day-detail-num">${data.done}<span class="day-detail-num-sep">/</span>${data.total}</span>
        <span class="day-detail-pct">完成率 ${pct}%</span>
        <span class="day-detail-xp">+${data.total_xp} XP</span>
      </div>
      <div class="day-detail-bar"><div class="day-detail-bar-fill" style="width:${pct}%"></div></div>
    `;
    data.habits.forEach(h => {
      const ico = getHabitIcon(h.habit_name);
      const li = document.createElement('li');
      li.className = `day-detail-item${h.checked ? ' done' : ''}`;
      li.innerHTML = `
        <div class="plan-item-icon ${ico.cls}">${ico.icon}</div>
        <div class="day-detail-name">${escapeHtml(h.habit_name)}</div>
        <div class="day-detail-mark">${h.checked ? '✓' : '○'}</div>
      `;
      listEl.appendChild(li);
    });
  } catch (err) {
    summaryEl.textContent = '加载失败：' + (err.message || '请重试');
  }
}

document.getElementById('btn-close-day-detail').addEventListener('click', () => {
  modalDayDetail.classList.add('hidden');
});
modalDayDetail.addEventListener('click', (e) => {
  if (e.target === modalDayDetail) modalDayDetail.classList.add('hidden');
});

document.getElementById('cal-prev').addEventListener('click', () => {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth()-1, 1);
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth()+1, 1);
  renderCalendar();
});

// ============ STATS ============
async function loadStats() {
  try {
    const logs = await api.get('/habits/logs?days=31');
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const monthLogs = logs.filter(l => l.checkin_date.startsWith(monthPrefix));
    const days = monthLogs.length;
    const tasks = monthLogs.reduce((s, l) => s + (l.count || 0), 0);
    const totalHabits = currentHabits.length;
    const dayOfMonth = now.getDate();
    const expected = totalHabits * dayOfMonth;
    const rate = expected > 0 ? Math.min(100, Math.round((tasks / expected) * 100)) : 0;
    document.getElementById('month-days').textContent = days;
    document.getElementById('month-tasks').textContent = tasks;
    document.getElementById('month-rate').textContent = `${rate}%`;
  } catch {}
}

// ============ CHAT ============
const chatFab = document.getElementById('chat-fab');
const chatOverlay = document.getElementById('chat-overlay');
chatFab.addEventListener('click', () => {
  chatOverlay.classList.remove('hidden');
  chatFab.style.display = 'none';
  loadChat();
  setTimeout(() => document.getElementById('chat-input').focus(), 100);
});
document.getElementById('chat-close').addEventListener('click', () => {
  chatOverlay.classList.add('hidden');
  chatFab.style.display = 'flex';
});

async function loadChat() {
  try {
    const messages = await api.get('/conversations');
    const history = document.getElementById('chat-history');
    const welcome = document.getElementById('chat-welcome');
    history.querySelectorAll('.message').forEach(m => m.remove());
    if (!messages || messages.length === 0) {
      welcome.style.display = 'block';
      return;
    }
    welcome.style.display = 'none';
    messages.forEach(msg => appendMessage(msg.role, msg.content, false));
    history.scrollTop = history.scrollHeight;
  } catch {}
}

function appendMessage(role, content, animate = true) {
  const history = document.getElementById('chat-history');
  document.getElementById('chat-welcome').style.display = 'none';
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.textContent = content;
  if (!animate) div.style.animation = 'none';
  history.appendChild(div);
  history.scrollTop = history.scrollHeight;
}

document.getElementById('btn-send').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  const btn = document.getElementById('btn-send');
  btn.disabled = true;
  appendMessage('user', content);
  try {
    const result = await api.post('/conversations', { content });
    appendMessage('assistant', result.assistantMessage.content);
    const plans = result.extractedPlans || [];
    const suggestions = result.suggestions || [];
    if (plans.length > 0 || suggestions.length > 0) {
      renderChatExtras(plans, suggestions);
    }
  } catch (err) {
    appendMessage('assistant', '哎呀，出了一点小问题，再试一次吧～');
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

function renderChatExtras(plans, suggestions) {
  const history = document.getElementById('chat-history');
  const wrap = document.createElement('div');
  wrap.className = 'chat-extras';

  if (plans.length > 0) {
    const card = document.createElement('div');
    card.className = 'chat-plan-card';
    const head = document.createElement('div');
    head.className = 'chat-plan-title';
    head.textContent = `📋 帮你提取了 ${plans.length} 个计划`;
    card.appendChild(head);

    plans.forEach((p) => {
      const ico = getHabitIcon(p.habit_name);
      const item = document.createElement('div');
      item.className = 'chat-plan-item';
      const freqLabel = p.frequency_type === 'daily' ? '每天' : `每周 ${p.frequency_count} 次`;
      item.innerHTML = `
        <div class="plan-item-icon ${ico.cls}">${ico.icon}</div>
        <div class="chat-plan-item-info">
          <div class="chat-plan-item-name"></div>
          <div class="chat-plan-item-meta"></div>
        </div>
        <button class="btn-add-plan-mini">+ 加入今日</button>
      `;
      item.querySelector('.chat-plan-item-name').textContent = p.habit_name;
      item.querySelector('.chat-plan-item-meta').textContent = freqLabel;
      const addBtn = item.querySelector('.btn-add-plan-mini');
      addBtn.addEventListener('click', () => addPlanFromChat(p, addBtn));
      card.appendChild(item);
    });

    if (plans.length > 1) {
      const addAll = document.createElement('button');
      addAll.className = 'btn-add-all-plans';
      addAll.textContent = `一键全部添加（${plans.length}）`;
      addAll.addEventListener('click', () => addAllPlansFromChat(plans, card, addAll));
      card.appendChild(addAll);
    }

    wrap.appendChild(card);
  }

  if (suggestions.length > 0) {
    const tip = document.createElement('div');
    tip.className = 'chat-tip-card';
    const tipHead = document.createElement('div');
    tipHead.className = 'chat-tip-title';
    tipHead.textContent = '💡 给你的小建议';
    tip.appendChild(tipHead);
    suggestions.forEach((s) => {
      const li = document.createElement('div');
      li.className = 'chat-tip-item';
      li.textContent = s;
      tip.appendChild(li);
    });
    wrap.appendChild(tip);
  }

  history.appendChild(wrap);
  history.scrollTop = history.scrollHeight;
}

async function addPlanFromChat(plan, btn) {
  if (btn.classList.contains('added')) return;
  btn.disabled = true;
  btn.textContent = '添加中…';
  try {
    await api.post('/habits', {
      habit_name: plan.habit_name,
      frequency_type: plan.frequency_type,
      frequency_count: plan.frequency_count,
    });
    btn.textContent = '✓ 已添加';
    btn.classList.add('added');
    await Promise.all([loadHabits(), loadProfile()]);
    applyAiGreeting(currentProfile);
    renderPlanPreview();
    showToast(`已加入：${plan.habit_name}`);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '+ 加入今日';
    showToast(err.message || '添加失败');
  }
}

async function addAllPlansFromChat(plans, card, addAllBtn) {
  addAllBtn.disabled = true;
  addAllBtn.textContent = '添加中…';
  let added = 0;
  for (const p of plans) {
    try {
      await api.post('/habits', {
        habit_name: p.habit_name,
        frequency_type: p.frequency_type,
        frequency_count: p.frequency_count,
      });
      added += 1;
    } catch {}
  }
  card.querySelectorAll('.btn-add-plan-mini').forEach((b) => {
    b.disabled = true;
    b.textContent = '✓ 已添加';
    b.classList.add('added');
  });
  addAllBtn.textContent = `✓ 已添加 ${added} 个`;
  await Promise.all([loadHabits(), loadProfile()]);
  applyAiGreeting(currentProfile);
  renderPlanPreview();
  showToast(`已加入 ${added} 个计划`);
}

// ============ SIDEBAR NAV ============
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    if (tab === 'plans') {
      document.querySelector('.plan-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (tab === 'stats') {
      window.location.href = '/stats.html';
    } else if (tab === 'settings') {
      openSettings();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
});

// ============ SWITCH CHARACTER ============
document.getElementById('btn-switch-char').addEventListener('click', () => {
  window.location.href = '/choose-character.html';
});

// ============ SETTINGS ============
function resetNavToToday() {
  document.querySelectorAll('.nav-item').forEach((b, i) => b.classList.toggle('active', i === 0));
}

async function openSettings() {
  document.getElementById('modal-settings').classList.remove('hidden');
  const me = getUser();
  document.getElementById('settings-current-user').textContent =
    me ? `${me.username} (ID: ${me.id})` : '未登录';

  const listEl = document.getElementById('settings-user-list');
  const countEl = document.getElementById('settings-user-count');
  listEl.innerHTML = '<li class="settings-user-row muted">加载中…</li>';

  try {
    const { users } = await apiFetch('/user/list');
    countEl.textContent = users.length;
    listEl.innerHTML = '';
    for (const u of users) {
      const li = document.createElement('li');
      li.className = 'settings-user-row';
      const isMe = me && u.id === me.id;
      const created = (u.created_at || '').split(' ')[0] || '';
      li.innerHTML = `
        <div class="settings-user-main">
          <span class="settings-user-name">${u.username}${isMe ? ' <span class="settings-user-badge">当前</span>' : ''}</span>
          <span class="settings-user-meta">Lv.${u.level} · ${created}</span>
        </div>
      `;
      listEl.appendChild(li);
    }
    if (users.length === 0) {
      listEl.innerHTML = '<li class="settings-user-row muted">暂无账号</li>';
    }
  } catch (err) {
    listEl.innerHTML = `<li class="settings-user-row muted">加载失败：${err.message}</li>`;
  }
}

document.getElementById('btn-close-settings').addEventListener('click', () => {
  document.getElementById('modal-settings').classList.add('hidden');
  resetNavToToday();
});

document.getElementById('btn-logout').addEventListener('click', () => {
  clearAuth();
  window.location.href = '/index.html';
});

document.getElementById('btn-open-reset').addEventListener('click', () => {
  document.getElementById('modal-reset').classList.remove('hidden');
});

document.getElementById('btn-cancel-reset').addEventListener('click', () => {
  document.getElementById('modal-reset').classList.add('hidden');
});

document.getElementById('btn-confirm-reset').addEventListener('click', async () => {
  const btn = document.getElementById('btn-confirm-reset');
  btn.disabled = true; btn.textContent = '重置中…';
  try {
    await apiFetch('/user/reset', { method: 'DELETE', body: { confirm: true } });
    document.getElementById('modal-reset').classList.add('hidden');
    document.getElementById('modal-settings').classList.add('hidden');
    resetNavToToday();
    await refreshAll();
    showToast('数据已重置 🔄');
  } catch (err) { alert(err.message); }
  finally { btn.disabled = false; btn.textContent = '确认重置'; }
});

if (window.location.hash === '#settings') {
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === 'settings');
  });
  openSettings();
}

document.getElementById('card-test').addEventListener('click', (e) => {
  if (e.target.closest('.test-skip')) return;
  window.location.href = '/character-test.html';
});

// ============ TOAST & UTILS ============
function showToast(msg) {
  const t = document.getElementById('xp-toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============ INIT ============
async function refreshAll() {
  await loadProfile();
  await loadHabits();
  await Promise.all([loadCalendar(), loadStats()]);
  applyAiGreeting(currentProfile);
  renderAvatarRow();
  renderPlanPreview();
}

async function init() {
  updateGreeting();
  try {
    await refreshAll();
  } catch (err) {
    console.error('Init error:', err);
  }
}

init();
