// Auth guard
if (!getToken()) window.location.href = '/index.html';

// ============ CHARACTER & ICON META ============
const CHARACTER_META = {
  1: { name: '学者猫', emoji: '🐱', img: { full: '/img/scholar-cat-full.png', avatar: '/img/scholar-cat-avatar.png' } },
  2: { name: '勇者犬', emoji: '🐶', img: { full: '/img/brave-dog-full.png', avatar: '/img/brave-dog-avatar.png' } },
  3: { name: '精灵鹿', emoji: '🦌', img: { full: '/img/spirit-deer-full.png', avatar: '/img/spirit-deer-avatar.png' } },
  4: { name: '机械龙', emoji: '🐉', img: { full: '/img/mecha-dragon-full.png', avatar: '/img/mecha-dragon-avatar.png' } },
  5: { name: '小幽灵', emoji: '👻', img: { full: '/img/ghostie-full.png', avatar: '/img/ghostie-avatar.png' } },
};

const HABIT_ICON_MAP = [
  { kw: /读|书|阅|学习/, icon: '📚', cls: 'icon-blue', color: '#6B8AFB' },
  { kw: /跑|步|运动|健身|锻炼/, icon: '🏃', cls: 'icon-orange', color: '#FFA866' },
  { kw: /编程|代码|coding|写代码/i, icon: '💻', cls: 'icon-purple', color: '#A98AF6' },
  { kw: /喝水|水/, icon: '💧', cls: 'icon-blue', color: '#6BC2FB' },
  { kw: /睡|休息|早睡/, icon: '😴', cls: 'icon-purple', color: '#9B8AF6' },
  { kw: /冥想|瑜伽|静坐/, icon: '🧘', cls: 'icon-green', color: '#74D6A0' },
  { kw: /写|日记|记录/, icon: '✍️', cls: 'icon-yellow', color: '#FFD261' },
  { kw: /英语|单词|语言/, icon: '🔤', cls: 'icon-pink', color: '#F58AB5' },
  { kw: /画|画画|绘/, icon: '🎨', cls: 'icon-pink', color: '#F5A8C5' },
  { kw: /音乐|乐器|琴|唱/, icon: '🎵', cls: 'icon-purple', color: '#B98AF6' },
  { kw: /做饭|烹饪|早餐/, icon: '🍳', cls: 'icon-yellow', color: '#FFC061' },
  { kw: /整理|打扫|清洁/, icon: '🧹', cls: 'icon-green', color: '#85D6A0' },
];

const PIE_PALETTE = ['#6B8AFB', '#FFA866', '#74D6A0', '#FFD261', '#F58AB5', '#A98AF6', '#6BC2FB', '#FF8A8A'];

// Stable color palette for per-habit dots in the completion calendar
const HABIT_DOT_PALETTE = ['#74D6A0', '#6B8AFB', '#FFA866', '#A98AF6', '#F58AB5', '#FFD261', '#6BC2FB', '#FF8A8A'];
function getHabitDotColor(habitId) {
  const idx = state.habits.findIndex(h => h.id === habitId);
  return HABIT_DOT_PALETTE[(idx < 0 ? 0 : idx) % HABIT_DOT_PALETTE.length];
}

function getHabitIcon(name) {
  for (const m of HABIT_ICON_MAP) if (m.kw.test(name)) return m;
  return { icon: '🌱', cls: 'icon-green', color: '#74D6A0' };
}

// ============ STATE ============
const state = {
  habits: [],
  logs: [],
  user: null,
  selectedHabitIds: new Set(), // empty = all
  view: 'week',                // week | month | year | completion
  // ranges (independent per view)
  weekStart: null,             // Monday
  monthDate: null,             // 1st of month
  yearDate: null,              // Jan 1 of year
  hmStart: null,
  hmEnd: null,
};

// ============ UTILS ============
function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseDateStr(s) { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
function addDays(d, n) { const r = new Date(d); r.setDate(d.getDate()+n); return r; }
function startOfWeekMon(d) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - day);
  return r;
}
function endOfWeekSun(d) { return addDays(startOfWeekMon(d), 6); }
function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function clampToToday(d) {
  const today = new Date(); today.setHours(0,0,0,0);
  return d > today ? today : d;
}

function getFilteredLogs(startStr, endStr) {
  const sel = state.selectedHabitIds;
  return state.logs.filter(l =>
    l.checkin_date >= startStr && l.checkin_date <= endStr &&
    (sel.size === 0 || sel.has(l.habit_id))
  );
}

// ============ DATA LOADING ============
async function loadAll() {
  const data = await api.get('/habits/stats?days=400');
  state.habits = data.habits || [];
  state.logs = data.logs || [];
  state.user = data.user || {};

  const today = new Date(); today.setHours(0,0,0,0);
  state.weekStart = startOfWeekMon(today);
  state.monthDate = new Date(today.getFullYear(), today.getMonth(), 1);
  state.yearDate = new Date(today.getFullYear(), 0, 1);
  state.hmStart = new Date(today.getFullYear(), today.getMonth(), 1);
  state.hmEnd = new Date(today.getFullYear(), today.getMonth()+1, 0);

  renderAll();
}

function renderAll() {
  renderSidebarChar();
  renderCharacterCard();
  renderHabitPickers();
  renderFilterPill();
  showActiveView();
  renderActiveView();
}

// ============ SIDEBAR ============
function renderSidebarChar() {
  const c = CHARACTER_META[state.user.role_id];
  const avatarEl = document.getElementById('sb-avatar');
  if (c && c.img && c.img.avatar) {
    avatarEl.innerHTML = `<img src="${c.img.avatar}" alt="${c.name}" class="char-img" />`;
  } else if (c) {
    avatarEl.textContent = c.emoji;
  } else {
    avatarEl.textContent = '🌟';
  }
  document.getElementById('sb-name').textContent = (c && c.name) || '伙伴';
  document.getElementById('sb-quote').textContent = state.user.username
    ? `${state.user.username} · 总 ${state.user.total_xp || 0} XP`
    : '一起加油';
}

document.querySelectorAll('.sidebar .nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab === 'stats') return;
    if (tab === 'settings') {
      window.location.href = '/plan.html#settings';
    } else {
      window.location.href = '/plan.html';
    }
  });
});

// ============ CHARACTER CARD ============
function renderCharacterCard() {
  const c = CHARACTER_META[state.user.role_id];
  const portrait = document.getElementById('stats-char-portrait');
  if (!portrait) return;
  if (c && c.img && c.img.full) {
    portrait.innerHTML = `<img src="${c.img.full}" alt="${c.name}" />`;
  } else if (c) {
    portrait.textContent = c.emoji;
  } else {
    portrait.textContent = '🌟';
  }
  document.getElementById('stats-char-name').textContent = (c && c.name) || '伙伴';
  document.getElementById('stats-char-msg').textContent = generateCharMsg();
}

function generateCharMsg() {
  const totalHabits = state.habits.length;
  if (totalHabits === 0) return '先去添加几个习惯，让我有的可以分析吧～';

  const today = new Date();
  const wkStart = startOfWeekMon(today);
  const wkStartStr = dateToStr(wkStart);
  const todayStr = dateToStr(today);
  const weekLogs = state.logs.filter(l => l.checkin_date >= wkStartStr && l.checkin_date <= todayStr);
  const weekDays = new Set(weekLogs.map(l => l.checkin_date)).size;
  const streak = state.user.streak_days || 0;

  const roleId = state.user.role_id;
  if (streak >= 14) {
    return ({
      1: `连续打卡 ${streak} 天，规律性已形成稳定模式。`,
      2: `${streak} 连冲！你就是习惯赛道的卷王！`,
      3: `${streak} 天啦～你温柔地坚持着，超级棒。`,
      4: `Streak: ${streak} 天，达成稳态，继续保持。`,
      5: `${streak} 天连击～小幽灵都看呆了。`,
    })[roleId] || `连续打卡 ${streak} 天，状态非常稳定！`;
  }
  if (weekDays >= 5) {
    return ({
      1: `本周打卡 ${weekDays} 天，节奏紧凑，效率良好。`,
      2: `本周打卡 ${weekDays} 天！冲冲冲！`,
      3: `本周已经打卡 ${weekDays} 天啦～继续顺其自然。`,
      4: `本周活跃度 ${Math.round(weekDays/7*100)}%，状态健康。`,
      5: `本周打了 ${weekDays} 天～嘻嘻不错嘛。`,
    })[roleId] || `本周打卡 ${weekDays} 天，超棒！`;
  }
  if (weekLogs.length === 0) {
    return ({
      1: '本周还没有数据，建议先从最容易的一项开始。',
      2: '本周还没动！冲一个最快的习惯打开局面！',
      3: '本周还没开始呢，慢慢来，做一个就好～',
      4: '本周记录为 0，建议立即重启执行。',
      5: '本周一片空白……要不今天来一下下？',
    })[roleId] || '本周还没有打卡，开始第一个吧！';
  }
  return ({
    1: `本周已完成 ${weekLogs.length} 次，再坚持几天就有连击奖励了。`,
    2: `本周搞定 ${weekLogs.length} 次！再加把劲！`,
    3: `本周完成 ${weekLogs.length} 次～按你的节奏走就好。`,
    4: `本周累计 ${weekLogs.length} 次，趋势上行。`,
    5: `本周完成 ${weekLogs.length} 次～挺好挺好～`,
  })[roleId] || `本周完成 ${weekLogs.length} 次，继续加油！`;
}

// ============ HABIT PICKERS (shared logic, multiple containers) ============
const PICKERS = [
  { grid: 'habit-picker-w', allBtn: 'hp-all-w' },
  { grid: 'habit-picker-m', allBtn: 'hp-all-m' },
  { grid: 'habit-picker-c', allBtn: 'hp-all-c' },
];

function renderHabitPickers() {
  PICKERS.forEach(p => {
    const grid = document.getElementById(p.grid);
    const allBtn = document.getElementById(p.allBtn);
    if (!grid || !allBtn) return;

    if (state.habits.length === 0) {
      grid.innerHTML = '<div class="hp-empty">还没有习惯哦，先去「我的计划」添加吧</div>';
      return;
    }
    grid.innerHTML = '';
    state.habits.forEach(h => {
      const ico = getHabitIcon(h.habit_name);
      const div = document.createElement('div');
      const selected = state.selectedHabitIds.has(h.id);
      div.className = `hp-item${selected ? ' selected' : ''}`;
      div.innerHTML = `
        <div class="hp-item-icon ${ico.cls}">${ico.icon}</div>
        <div class="hp-item-name">${escapeHtml(h.habit_name)}</div>
        ${selected ? '<span class="hp-check">✓</span>' : ''}
      `;
      div.addEventListener('click', () => {
        if (state.selectedHabitIds.has(h.id)) state.selectedHabitIds.delete(h.id);
        else state.selectedHabitIds.add(h.id);
        renderHabitPickers();
        renderFilterPill();
        renderActiveView();
      });
      grid.appendChild(div);
    });
    allBtn.classList.toggle('active', state.selectedHabitIds.size === 0);
  });
}

PICKERS.forEach(p => {
  const btn = document.getElementById(p.allBtn);
  if (btn) btn.addEventListener('click', () => {
    state.selectedHabitIds.clear();
    renderHabitPickers();
    renderFilterPill();
    renderActiveView();
  });
});

// ============ PAGE-HEADER FILTER PILL ============
function renderFilterPill() {
  const label = document.getElementById('filter-pill-label');
  const menu = document.getElementById('filter-menu');
  if (!label || !menu) return;

  const sel = state.selectedHabitIds;
  if (sel.size === 0) label.textContent = '全部习惯';
  else if (sel.size === 1) {
    const h = state.habits.find(x => sel.has(x.id));
    label.textContent = h ? h.habit_name : '1 个习惯';
  } else label.textContent = `${sel.size} 个习惯`;

  const allActive = sel.size === 0 ? ' active' : '';
  let html = `<button class="filter-opt${allActive}" data-id="">全部习惯</button>`;
  state.habits.forEach(h => {
    const active = sel.has(h.id) ? ' active' : '';
    const dot = getHabitDotColor(h.id);
    html += `<button class="filter-opt${active}" data-id="${h.id}">
      <span class="filter-opt-dot" style="background:${dot}"></span>
      <span class="filter-opt-name">${escapeHtml(h.habit_name)}</span>
      ${active ? '<span class="filter-opt-check">✓</span>' : ''}
    </button>`;
  });
  menu.innerHTML = html;

  menu.querySelectorAll('.filter-opt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!id) {
        state.selectedHabitIds.clear();
      } else {
        const idNum = Number(id);
        if (state.selectedHabitIds.has(idNum)) state.selectedHabitIds.delete(idNum);
        else state.selectedHabitIds.add(idNum);
      }
      renderHabitPickers();
      renderFilterPill();
      renderActiveView();
    });
  });
}

(function initFilterPill() {
  const pill = document.getElementById('filter-pill');
  const menu = document.getElementById('filter-menu');
  if (!pill || !menu) return;
  pill.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !menu.classList.contains('hidden');
    if (open) {
      menu.classList.add('hidden');
      pill.setAttribute('aria-expanded', 'false');
    } else {
      menu.classList.remove('hidden');
      pill.setAttribute('aria-expanded', 'true');
    }
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== pill) {
      menu.classList.add('hidden');
      pill.setAttribute('aria-expanded', 'false');
    }
  });
})();

// ============ VIEW SWITCHING ============
document.querySelectorAll('.ssn-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ssn-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.view = btn.dataset.view;
    showActiveView();
    renderActiveView();
  });
});

function showActiveView() {
  document.querySelectorAll('.view-pane').forEach(pane => {
    pane.hidden = true;
  });
  const target = document.getElementById('view-' + state.view);
  if (target) target.hidden = false;
}

function renderActiveView() {
  if (state.view === 'week') renderWeekView();
  else if (state.view === 'month') renderMonthView();
  else if (state.view === 'year') renderYearView();
  else if (state.view === 'completion') renderHeatmapView();
  renderSubHeader();
}

// ============ NAV BUTTONS ============
document.querySelectorAll('[data-shift]').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.shift;
    if (action === 'week-prev') state.weekStart = addDays(state.weekStart, -7);
    else if (action === 'week-next') state.weekStart = addDays(state.weekStart, 7);
    else if (action === 'month-prev') state.monthDate = new Date(state.monthDate.getFullYear(), state.monthDate.getMonth()-1, 1);
    else if (action === 'month-next') state.monthDate = new Date(state.monthDate.getFullYear(), state.monthDate.getMonth()+1, 1);
    else if (action === 'year-prev') state.yearDate = new Date(state.yearDate.getFullYear()-1, 0, 1);
    else if (action === 'year-next') state.yearDate = new Date(state.yearDate.getFullYear()+1, 0, 1);
    else if (action === 'hm-prev') {
      state.hmStart = new Date(state.hmStart.getFullYear(), state.hmStart.getMonth()-1, 1);
      state.hmEnd = new Date(state.hmStart.getFullYear(), state.hmStart.getMonth()+1, 0);
    } else if (action === 'hm-next') {
      state.hmStart = new Date(state.hmStart.getFullYear(), state.hmStart.getMonth()+1, 1);
      state.hmEnd = new Date(state.hmStart.getFullYear(), state.hmStart.getMonth()+1, 0);
    }
    renderActiveView();
  });
});

function renderSubHeader() {
  let lbl = '';
  if (state.view === 'week') {
    const s = state.weekStart, e = endOfWeekSun(s);
    lbl = `${s.getFullYear()}年${s.getMonth()+1}月${s.getDate()}日 - ${e.getMonth()+1}月${e.getDate()}日 · 周视图`;
  } else if (state.view === 'month') {
    lbl = `${state.monthDate.getFullYear()}年${state.monthDate.getMonth()+1}月 · 月视图`;
  } else if (state.view === 'year') {
    lbl = `${state.yearDate.getFullYear()}年 · 年视图`;
  } else {
    lbl = `${state.hmStart.getFullYear()}年${state.hmStart.getMonth()+1}月 · 完成统计`;
  }
  const selCount = state.selectedHabitIds.size;
  const habitDesc = selCount === 0 ? '全部习惯' : `${selCount} 个习惯`;
  document.getElementById('stats-page-sub').textContent = `${lbl} · ${habitDesc}`;
}

// ============ WEEK VIEW ============
function renderWeekView() {
  const s = state.weekStart;
  const e = endOfWeekSun(s);
  document.getElementById('week-label').textContent =
    `${s.getFullYear()}年${s.getMonth()+1}月${s.getDate()}日 - ${e.getMonth()+1}月${e.getDate()}日`;

  const startStr = dateToStr(s), endStr = dateToStr(e);
  const logs = getFilteredLogs(startStr, endStr);

  // KPIs
  const xp = logs.reduce((sum, l) => sum + (l.xp_earned || 0), 0);
  const habitCount = state.selectedHabitIds.size === 0 ? state.habits.length : state.selectedHabitIds.size;
  const today = new Date(); today.setHours(0,0,0,0);
  const dayCount = Math.min(7, Math.floor((today - s) / 86400000) + 1);
  const expected = habitCount * Math.max(1, dayCount);
  const rate = expected > 0 ? Math.min(100, Math.round((logs.length / expected) * 100)) : 0;

  document.getElementById('kpi-w-streak').textContent = state.user.streak_days || 0;
  document.getElementById('kpi-w-rate').textContent = rate;
  document.getElementById('kpi-w-xp').textContent = xp;
  document.getElementById('kpi-w-tasks').textContent = logs.length;

  // Day bars: one bar per day
  const dayLabels = ['周一','周二','周三','周四','周五','周六','周日'];
  const counts = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(s, i);
    const ds = dateToStr(d);
    const c = logs.filter(l => l.checkin_date === ds).length;
    counts.push({ date: d, ds, count: c, label: dayLabels[i] });
  }
  const maxC = Math.max(habitCount, ...counts.map(c => c.count), 1);

  const wrap = document.getElementById('week-day-bars');
  wrap.innerHTML = '';
  counts.forEach(c => {
    const isToday = dateToStr(today) === c.ds;
    const isFuture = c.date > today;
    const pct = isFuture ? 0 : (c.count / maxC) * 100;
    const row = document.createElement('div');
    row.className = 'day-bar-row';
    row.innerHTML = `
      <div class="dbr-label">
        <div class="dbr-dow${isToday ? ' is-today' : ''}">${c.label}</div>
        <div class="dbr-md">${c.date.getMonth()+1}/${c.date.getDate()}</div>
      </div>
      <div class="dbr-track">
        <div class="dbr-fill${isFuture ? ' is-future' : ''}" style="width:${pct}%"></div>
      </div>
      <div class="dbr-count">${isFuture ? '—' : c.count + ' 次'}</div>
    `;
    wrap.appendChild(row);
  });
}

// ============ MONTH VIEW ============
function renderMonthView() {
  const md = state.monthDate;
  document.getElementById('month-label').textContent = `${md.getFullYear()}年${md.getMonth()+1}月`;

  const monthStart = new Date(md.getFullYear(), md.getMonth(), 1);
  const monthEnd = new Date(md.getFullYear(), md.getMonth()+1, 0);
  const startStr = dateToStr(monthStart), endStr = dateToStr(monthEnd);
  const logs = getFilteredLogs(startStr, endStr);

  // KPIs
  const habitCount = state.selectedHabitIds.size === 0 ? state.habits.length : state.selectedHabitIds.size;
  const today = new Date(); today.setHours(0,0,0,0);
  const isCurrentMonth = today >= monthStart && today <= monthEnd;
  const dayCount = isCurrentMonth ? today.getDate() : monthEnd.getDate();
  const expected = habitCount * Math.max(1, dayCount);
  const rate = expected > 0 ? Math.min(100, Math.round((logs.length / expected) * 100)) : 0;
  const xp = logs.reduce((s, l) => s + (l.xp_earned || 0), 0);
  const activeHabits = new Set(logs.map(l => l.habit_id)).size;

  document.getElementById('kpi-m-streak').textContent = state.user.streak_days || 0;
  document.getElementById('kpi-m-rate').textContent = rate;
  document.getElementById('kpi-m-xp').textContent = xp;
  document.getElementById('kpi-m-habits').textContent = activeHabits || habitCount;

  // Calendar grid
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  // counts/expected per date
  const countsByDate = {};
  logs.forEach(l => { countsByDate[l.checkin_date] = (countsByDate[l.checkin_date] || 0) + 1; });

  // Pad start to Monday
  const startDow = (monthStart.getDay() + 6) % 7;
  const gridStart = addDays(monthStart, -startDow);
  const totalDays = monthEnd.getDate() + startDow;
  const totalCells = Math.ceil(totalDays / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const d = addDays(gridStart, i);
    const inMonth = d.getMonth() === md.getMonth();
    const ds = dateToStr(d);
    const isFuture = d > today;
    const cnt = countsByDate[ds] || 0;

    let status = 'none';
    if (inMonth && !isFuture) {
      if (habitCount > 0 && cnt >= habitCount) status = 'full';
      else if (cnt > 0) status = 'partial';
      else status = 'miss';
    }

    const cell = document.createElement('div');
    cell.className = `cal-cell cal-${status}${inMonth ? '' : ' cal-out'}${isFuture ? ' cal-future' : ''}`;
    cell.innerHTML = `
      <div class="cal-day">${d.getDate()}</div>
      ${status === 'full' ? '<div class="cal-mark">✨</div>' : ''}
      ${status === 'partial' ? '<div class="cal-mark">🌙</div>' : ''}
    `;
    if (inMonth && !isFuture) {
      cell.dataset.date = ds;
      cell.dataset.count = String(cnt);
      cell.addEventListener('mouseenter', showTooltip);
      cell.addEventListener('mousemove', moveTooltip);
      cell.addEventListener('mouseleave', hideTooltip);
    }
    grid.appendChild(cell);
  }

  // Monthly habit summary
  const summaryWrap = document.getElementById('month-summary');
  const sel = state.selectedHabitIds;
  const habitList = sel.size === 0 ? state.habits : state.habits.filter(h => sel.has(h.id));
  if (habitList.length === 0) {
    summaryWrap.innerHTML = '<div class="ms-empty">还没有数据</div>';
  } else {
    summaryWrap.innerHTML = '';
    habitList.forEach(h => {
      const hLogs = logs.filter(l => l.habit_id === h.id);
      const hDays = new Set(hLogs.map(l => l.checkin_date)).size;
      const expectedDays = isCurrentMonth ? today.getDate() : monthEnd.getDate();
      const pct = expectedDays > 0 ? Math.min(100, Math.round((hDays / expectedDays) * 100)) : 0;
      const ico = getHabitIcon(h.habit_name);
      const row = document.createElement('div');
      row.className = 'ms-row';
      row.innerHTML = `
        <div class="ms-icon ${ico.cls}">${ico.icon}</div>
        <div class="ms-body">
          <div class="ms-name">${escapeHtml(h.habit_name)}</div>
          <div class="ms-track"><div class="ms-fill" style="width:${pct}%; background:${ico.color}"></div></div>
        </div>
        <div class="ms-pct">${pct}%</div>
      `;
      summaryWrap.appendChild(row);
    });
  }

  // Encouragement text
  let encouragement = '保持节奏，每天进步一点点～';
  if (rate >= 80) encouragement = '本月状态超棒！继续保持这个节奏 🎉';
  else if (rate >= 50) encouragement = '已经过半啦，再加把劲就更稳了！';
  else if (rate > 0) encouragement = '慢慢来，每完成一次都是积累～';
  else encouragement = '试着今天先打一个卡，开个好头吧！';
  document.getElementById('encourage-text').textContent = encouragement;
}

// ============ YEAR VIEW ============
function renderYearView() {
  const yd = state.yearDate;
  const year = yd.getFullYear();
  document.getElementById('year-label').textContent = `${year}年`;
  document.getElementById('year-trend-title').textContent = `${year}年习惯坚持趋势`;

  const startStr = `${year}-01-01`, endStr = `${year}-12-31`;
  const logs = getFilteredLogs(startStr, endStr);

  // KPIs
  const totalDays = new Set(logs.map(l => l.checkin_date)).size;
  const today = new Date(); today.setHours(0,0,0,0);
  const isCurrentYear = today.getFullYear() === year;
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const elapsedDays = isCurrentYear
    ? Math.floor((today - yearStart) / 86400000) + 1
    : Math.floor((yearEnd - yearStart) / 86400000) + 1;
  const habitCount = state.selectedHabitIds.size === 0 ? state.habits.length : state.selectedHabitIds.size;
  const expected = habitCount * Math.max(1, elapsedDays);
  const rate = expected > 0 ? Math.min(100, Math.round((logs.length / expected) * 100)) : 0;
  const xp = logs.reduce((s, l) => s + (l.xp_earned || 0), 0);
  const longestStreak = computeLongestStreak(logs, yearStart, isCurrentYear ? today : yearEnd);

  document.getElementById('kpi-y-days').textContent = totalDays;
  document.getElementById('kpi-y-rate').textContent = rate;
  document.getElementById('kpi-y-streak').textContent = longestStreak;
  document.getElementById('kpi-y-xp').textContent = xp;
  document.getElementById('kpi-y-habits').textContent = habitCount;

  // Year trend area chart (per-month logs)
  const monthlyTotals = new Array(12).fill(0);
  const monthlyDays = new Array(12).fill(0);
  const seenDates = new Array(12).fill(null).map(() => new Set());
  logs.forEach(l => {
    const dt = parseDateStr(l.checkin_date);
    if (dt.getFullYear() !== year) return;
    const m = dt.getMonth();
    monthlyTotals[m]++;
    seenDates[m].add(l.checkin_date);
  });
  for (let i = 0; i < 12; i++) monthlyDays[i] = seenDates[i].size;

  drawYearTrend(monthlyTotals);
  drawMonthBars(monthlyDays);
  drawHabitPie(logs);
}

function computeLongestStreak(logs, start, end) {
  const dates = new Set(logs.map(l => l.checkin_date));
  let longest = 0, cur = 0;
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    if (dates.has(dateToStr(d))) { cur++; if (cur > longest) longest = cur; }
    else cur = 0;
  }
  return longest;
}

function drawYearTrend(monthlyTotals) {
  const W = 720, H = 220, P = 36;
  const innerW = W - P * 2, innerH = H - P * 2;
  const max = Math.max(2, ...monthlyTotals);
  const xStep = innerW / 11;
  const pts = monthlyTotals.map((v, i) => ({
    x: P + i * xStep,
    y: H - P - (v / max) * innerH,
    v, m: i+1,
  }));
  const linePath = pts.map((p, i) => `${i===0?'M':'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${pts[11].x.toFixed(1)} ${H-P} L${P} ${H-P} Z`;

  const yTicks = 4;
  const grid = [];
  const ylbl = [];
  for (let i = 0; i <= yTicks; i++) {
    const t = i / yTicks;
    const y = P + innerH * (1 - t);
    grid.push(`<line x1="${P}" y1="${y}" x2="${W-P}" y2="${y}" stroke="#EEF1F7" stroke-width="1" />`);
    ylbl.push(`<text x="${P-8}" y="${y+4}" text-anchor="end" font-size="10" fill="#9aa3b2">${Math.round(max*t)}</text>`);
  }
  const xlbl = pts.map(p => `<text x="${p.x}" y="${H-P+16}" text-anchor="middle" font-size="10" fill="#9aa3b2">${p.m}月</text>`).join('');
  const dots = pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#6B8AFB" />`).join('');

  const body = document.getElementById('year-trend');
  body.innerHTML = `
    <svg class="line-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="yearGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#6B8AFB" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#6B8AFB" stop-opacity="0.05"/>
        </linearGradient>
      </defs>
      ${grid.join('')}
      ${ylbl.join('')}
      <path d="${areaPath}" fill="url(#yearGrad)" />
      <path d="${linePath}" fill="none" stroke="#6B8AFB" stroke-width="2.5" stroke-linejoin="round" />
      ${dots}
      ${xlbl}
    </svg>
  `;
}

function drawMonthBars(monthlyDays) {
  const wrap = document.getElementById('year-month-bars');
  wrap.innerHTML = '';
  const max = Math.max(1, ...monthlyDays);
  for (let i = 0; i < 12; i++) {
    const v = monthlyDays[i];
    const pct = (v / max) * 100;
    const col = document.createElement('div');
    col.className = 'mb-col';
    col.innerHTML = `
      <div class="mb-bar-track"><div class="mb-bar-fill" style="height:${pct}%"></div></div>
      <div class="mb-num">${v}</div>
      <div class="mb-lbl">${i+1}月</div>
    `;
    wrap.appendChild(col);
  }
}

function drawHabitPie(logs) {
  const svg = document.getElementById('habit-pie');
  const legend = document.getElementById('habit-pie-legend');
  if (!svg) return;
  svg.innerHTML = '';
  legend.innerHTML = '';

  const totals = {};
  logs.forEach(l => { totals[l.habit_id] = (totals[l.habit_id] || 0) + 1; });

  const sel = state.selectedHabitIds;
  const habitList = sel.size === 0 ? state.habits : state.habits.filter(h => sel.has(h.id));
  const data = habitList
    .map((h, idx) => ({ id: h.id, name: h.habit_name, value: totals[h.id] || 0, color: PIE_PALETTE[idx % PIE_PALETTE.length] }))
    .filter(d => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    svg.innerHTML = `<circle cx="60" cy="60" r="50" fill="none" stroke="#EEF1F7" stroke-width="14"/>
      <text x="60" y="64" text-anchor="middle" font-size="11" fill="#9aa3b2">暂无数据</text>`;
    return;
  }

  const cx = 60, cy = 60, R = 48, r = 28;
  let acc = 0;
  data.forEach(d => {
    const start = acc / total * Math.PI * 2 - Math.PI / 2;
    const end = (acc + d.value) / total * Math.PI * 2 - Math.PI / 2;
    acc += d.value;
    const large = (end - start) > Math.PI ? 1 : 0;
    const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
    const x2 = cx + R * Math.cos(end), y2 = cy + R * Math.sin(end);
    const x3 = cx + r * Math.cos(end), y3 = cy + r * Math.sin(end);
    const x4 = cx + r * Math.cos(start), y4 = cy + r * Math.sin(start);
    const path = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
    const seg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    seg.setAttribute('d', path);
    seg.setAttribute('fill', d.color);
    svg.appendChild(seg);
  });

  data.forEach(d => {
    const pct = Math.round(d.value / total * 100);
    const li = document.createElement('div');
    li.className = 'pie-leg-row';
    li.innerHTML = `
      <span class="pie-swatch" style="background:${d.color}"></span>
      <span class="pie-name">${escapeHtml(d.name)}</span>
      <span class="pie-pct">${pct}%</span>
    `;
    legend.appendChild(li);
  });
}

// ============ COMPLETION VIEW (calendar + per-habit dots) ============
function renderHeatmapView() {
  const md = state.hmStart;
  const monthStart = new Date(md.getFullYear(), md.getMonth(), 1);
  const monthEnd = new Date(md.getFullYear(), md.getMonth()+1, 0);
  document.getElementById('hm-label').textContent = `${monthStart.getFullYear()}年${monthStart.getMonth()+1}月`;

  const sel = state.selectedHabitIds;
  const selectedHabits = sel.size === 0
    ? state.habits
    : state.habits.filter(h => sel.has(h.id));
  const habitCount = selectedHabits.length;

  const startStr = dateToStr(monthStart);
  const endStr = dateToStr(monthEnd);
  const logs = getFilteredLogs(startStr, endStr);

  // Group logs by date -> Set of habit_ids done
  const doneByDate = {};
  logs.forEach(l => {
    if (!doneByDate[l.checkin_date]) doneByDate[l.checkin_date] = new Set();
    doneByDate[l.checkin_date].add(l.habit_id);
  });

  // Build 7xN grid starting Monday
  const grid = document.getElementById('heatmap');
  grid.innerHTML = '';
  const startDow = (monthStart.getDay() + 6) % 7;
  const gridStart = addDays(monthStart, -startDow);
  const totalDays = monthEnd.getDate() + startDow;
  const totalCells = Math.ceil(totalDays / 7) * 7;

  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = dateToStr(today);

  for (let i = 0; i < totalCells; i++) {
    const d = addDays(gridStart, i);
    const inMonth = d.getMonth() === monthStart.getMonth();
    const ds = dateToStr(d);
    const isFuture = d > today;
    const isToday = ds === todayStr;
    const doneSet = doneByDate[ds] || new Set();

    const allDone = habitCount > 0 && selectedHabits.every(h => doneSet.has(h.id));

    let cls = 'comp-cell';
    if (!inMonth) cls += ' comp-out';
    if (isFuture) cls += ' comp-future';
    if (isToday) cls += ' comp-today';
    if (allDone && !isFuture && inMonth) cls += ' comp-all-done';

    const cell = document.createElement('div');
    cell.className = cls;

    const dotsHtml = selectedHabits.map(h => {
      const done = doneSet.has(h.id);
      const color = getHabitDotColor(h.id);
      return `<span class="comp-dot${done ? '' : ' comp-dot-miss'}" style="${done ? `background:${color}` : ''}"></span>`;
    }).join('');

    cell.innerHTML = `
      <div class="comp-day">${d.getDate()}</div>
      <div class="comp-dots">${dotsHtml}</div>
    `;

    if (!isFuture) {
      cell.dataset.date = ds;
      cell.dataset.count = String(doneSet.size);
      cell.addEventListener('mouseenter', showTooltip);
      cell.addEventListener('mousemove', moveTooltip);
      cell.addEventListener('mouseleave', hideTooltip);
    }
    grid.appendChild(cell);
  }

  // ===== Legend =====
  const legend = document.getElementById('completion-legend');
  if (legend) {
    const items = selectedHabits.map(h => `
      <span class="comp-lg-item">
        <span class="comp-lg-dot" style="background:${getHabitDotColor(h.id)}"></span>
        <span class="comp-lg-name">${escapeHtml(h.habit_name)}</span>
      </span>`).join('');
    legend.innerHTML = `${items}
      <span class="comp-lg-item comp-lg-miss">
        <span class="comp-lg-dot comp-lg-dot-miss"></span>
        <span class="comp-lg-name">未完成</span>
      </span>`;
  }

  // ===== Stats =====
  // 本月完成天数: any selected habit done that day (or all done? — match image: count days with at least 1 check among selected)
  let completedDays = 0;
  for (let d = new Date(monthStart); d <= monthEnd && d <= today; d = addDays(d, 1)) {
    if ((doneByDate[dateToStr(d)] || new Set()).size > 0) completedDays++;
  }
  const isCurrentMonth = today >= monthStart && today <= monthEnd;
  const elapsedDays = isCurrentMonth ? today.getDate() : monthEnd.getDate();
  const expected = habitCount * Math.max(1, elapsedDays);
  const rate = expected > 0 ? Math.min(100, Math.round((logs.length / expected) * 100)) : 0;

  // 连续完成 (current streak ending at today, within month)
  let currentStreak = 0;
  for (let d = new Date(today); d >= monthStart; d = addDays(d, -1)) {
    const ds = dateToStr(d);
    const set = doneByDate[ds] || new Set();
    const allDone = habitCount > 0 && selectedHabits.every(h => set.has(h.id));
    if (allDone) currentStreak++; else break;
  }

  // 最长连续 (longest run of all-done days in month, up to today)
  let longest = 0, run = 0;
  const lastDay = isCurrentMonth ? today : monthEnd;
  for (let d = new Date(monthStart); d <= lastDay; d = addDays(d, 1)) {
    const ds = dateToStr(d);
    const set = doneByDate[ds] || new Set();
    const allDone = habitCount > 0 && selectedHabits.every(h => set.has(h.id));
    if (allDone) { run++; if (run > longest) longest = run; }
    else run = 0;
  }

  document.getElementById('cstat-days').textContent = completedDays;
  document.getElementById('cstat-rate').textContent = rate;
  document.getElementById('cstat-streak').textContent = currentStreak;
  document.getElementById('cstat-max-streak').textContent = longest;
}

// ============ TOOLTIP (shared) ============
const tooltip = document.getElementById('hm-tooltip');
function showTooltip(e) {
  const cell = e.currentTarget;
  const ds = cell.dataset.date;
  if (!ds) return;
  const count = Number(cell.dataset.count);
  const dt = parseDateStr(ds);
  const days = ['周日','周一','周二','周三','周四','周五','周六'];
  const dayLogs = state.logs.filter(l =>
    l.checkin_date === ds &&
    (state.selectedHabitIds.size === 0 || state.selectedHabitIds.has(l.habit_id))
  );
  const xp = dayLogs.reduce((s, l) => s + (l.xp_earned || 0), 0);
  const habitNames = dayLogs.map(l => {
    const h = state.habits.find(h => h.id === l.habit_id);
    return h ? h.habit_name : '';
  }).filter(Boolean);

  tooltip.innerHTML = `
    <div class="hm-tip-title">${dt.getMonth()+1}/${dt.getDate()} · ${days[dt.getDay()]}</div>
    <div class="hm-tip-line">${count > 0 ? `完成 ${count} 次` : '没有打卡'}</div>
    ${habitNames.length ? `<div class="hm-tip-list">${habitNames.map(escapeHtml).join('、')}</div>` : ''}
    ${xp > 0 ? `<div class="hm-tip-xp">+${xp} XP</div>` : ''}
  `;
  tooltip.classList.remove('hidden');
  moveTooltip(e);
}
function moveTooltip(e) {
  const x = e.clientX + 14, y = e.clientY + 14;
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}
function hideTooltip() { tooltip.classList.add('hidden'); }

// ============ INIT ============
async function init() {
  try {
    await loadAll();
  } catch (err) {
    console.error('Stats init error:', err);
    document.getElementById('stats-page-sub').textContent = '加载失败：' + (err.message || '请重试');
  }
}

init();
