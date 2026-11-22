import { GITHUB_CONFIG, DUPLICATE_THRESHOLD } from './config.js';
import { $, escapeHtml, debounce, icon, copyText } from './utils.js';
import { state } from './store.js';
import { fetchIssues, isConfigValid, cacheRemainMs } from './api.js';
import { setIssueCount } from './tab.js';

let refreshLabelTimer = null;
let loadVersion = 0;

const SEVERITY_ORDER = ['轻微', '一般', '严重', '致命'];
const TYPE_ORDER = ['界面显示', '功能异常', '闪退卡死', '性能问题', '其他'];

/* 从 Issue 正文里解析出「严重程度」，旧数据没有这一段就返回空串 */
export function parseSeverity(body) {
  if (!body) return '';
  const m = String(body).match(/\*\*严重程度\*\*\s*[：:]\s*(轻微|一般|严重|致命)/);
  return m ? m[1] : '';
}

/* 从正文里解析「问题类型」：兼容旧文案与手写的近似值 */
export function parseType(body) {
  if (!body) return '';
  const m = String(body).match(/\*\*问题类型\*\*\s*[：:]\s*([^\n]+)/);
  if (!m) return '';
  const raw = m[1].trim();
  if (raw.indexOf('闪退') !== -1) return '闪退卡死';
  return TYPE_ORDER.indexOf(raw) !== -1 ? raw : '其他';
}

/* ---------- 骨架屏 / 错误 ---------- */
function renderSkeleton(container) {
  container.innerHTML =
    '<div class="skeleton-list" aria-hidden="true">' +
    '<div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div>' +
    '</div>';
}

function renderIssuesError(err) {
  const container = $('#issuesContainer');
  const ghUrl = 'https://github.com/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/issues';
  const link = ' <a class="err-link" href="' + ghUrl + '" target="_blank" rel="noopener noreferrer">直接去 GitHub 看 →</a>';

  let html;
  if (err && err.type === 'rate-limit') {
    html = '⏳ GitHub 接口限流，约 <strong>' + err.minutes +
      ' 分钟</strong>后恢复' + link;
  } else if (err && err.type === 'not-found') {
    html = '❌ 仓库不存在或为私有仓库' + link;
  } else if (err && err.type === 'timeout') {
    html = '⏱️ 请求超时，请刷新重试' + link;
  } else if (err && err.type === 'network') {
    html = '📡 网络异常，暂时连不上 GitHub';
  } else {
    const status = err && err.status ? err.status : '未知';
    html = '❌ 加载失败（状态码 ' + escapeHtml(status) + '）' + link;
  }

  container.innerHTML = '<div class="issues-error">' + html + '</div>';
}

/* 兜底提示：说明列表来自旧缓存，以及多久恢复 */
function staleNoteHtml() {
  if (!state.stale) return '';
  const when = state.cachedAt
    ? new Date(state.cachedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '';
  const reason = state.staleMinutes > 0
    ? 'GitHub 接口限流中，约 ' + state.staleMinutes + ' 分钟后自动恢复'
    : '网络暂时不通';
  return '<div class="truncate-note stale-note">🕒 显示的是' +
    (when ? ' ' + when + ' ' : '') + '的缓存数据（' + reason + '）' +
    '<button type="button" class="stale-retry" id="staleRetryBtn">重试</button>' +
    '</div>';
}

/* ---------- 刷新按钮的缓存倒计时 ---------- */
function scheduleRefreshLabel() {
  clearInterval(refreshLabelTimer);
  const paint = () => {
    const btn = $('#refreshBtn');
    if (!btn || btn.disabled) return;
    const remain = cacheRemainMs();
    const minutes = remain > 0 ? Math.ceil(remain / 60000) : 0;
    btn.innerHTML = icon('refresh') + (minutes > 0 ? ' 刷新 (' + minutes + ')' : ' 刷新');
    if (minutes <= 0) clearInterval(refreshLabelTimer);
  };
  paint();
  refreshLabelTimer = setInterval(paint, 10000);
}

/* ---------- 快捷筛选 ---------- */
export function setQuickFilter(name) {
  const allowed = ['all', 'open', 'urgent', 'closed'];
  state.quick = allowed.indexOf(name) !== -1 ? name : 'all';

  const chips = document.querySelectorAll('#quickChips .chip');
  Array.prototype.forEach.call(chips, (chip) => {
    const active = chip.dataset.chip === state.quick;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', String(active));
  });

  renderIssues();
}

/* ---------- 加载入口 ---------- */
export async function loadIssues(options) {
  const force = !!(options && options.force);
  const myVersion = ++loadVersion;
  const container = $('#issuesContainer');
  const btn = $('#refreshBtn');

  if (!isConfigValid()) {
    container.innerHTML = '<div class="issues-error">⚠️ 尚未配置 GitHub 仓库（owner / repo 为空），暂时无法加载列表。</div>';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = icon('refresh') + ' 加载中';
  container.setAttribute('aria-busy', 'true');
  renderSkeleton(container);

  try {
    const result = await fetchIssues({ force });
    if (myVersion !== loadVersion) return;          // 有更新的请求在途，丢弃本次结果
    state.allIssues = result.data.filter((item) => !item.pull_request);
    state.truncated = !!result.truncated;
    state.stale = !!result.stale;
    state.cachedAt = result.cachedAt || 0;
    state.staleMinutes = result.minutes || 0;
    updateStats(state.allIssues);
    renderIssues();
    checkDuplicate();
  } catch (err) {
    if (myVersion !== loadVersion) return;
    console.error('加载 Issues 失败:', err);
    state.stale = false;
    renderIssuesError(err);
    $('#issueCount').textContent = '?';
  } finally {
    if (myVersion === loadVersion) {
      btn.disabled = false;
      container.removeAttribute('aria-busy');
      scheduleRefreshLabel();
    }
  }
}

/* ---------- 统计 ---------- */
function updateStats(list) {
  const total = list.length;
  const open = list.filter((i) => i.state === 'open').length;
  const closed = total - open;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const week = list.filter((i) => new Date(i.created_at) >= sevenDaysAgo).length;

  $('#statTotal').textContent = total;
  $('#statOpen').textContent = open;
  $('#statClosed').textContent = closed;
  $('#statWeek').textContent = week;

  renderTypeBreakdown(list);
}

/* 「问题类型分布」横条：比四个数字更能说明问题集中在哪 */
function renderTypeBreakdown(list) {
  const box = $('#typeBreakdown');
  if (!box) return;

  /* 一条报告都没有时不占版面：留着五条空横条只是噪音 */
  if (!list.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;

  const counts = {};
  TYPE_ORDER.forEach((t) => { counts[t] = 0; });
  list.forEach((issue) => {
    const t = parseType(issue.body);
    if (t) counts[t] = (counts[t] || 0) + 1;
  });

  const max = Math.max.apply(null, TYPE_ORDER.map((t) => counts[t]).concat([1]));
  const total = list.length;

  box.innerHTML =
    '<div class="type-title">问题类型分布</div>' +
    TYPE_ORDER.map((t) => {
      const n = counts[t] || 0;
      const width = total ? Math.round((n / max) * 100) : 0;
      return '<div class="type-row">' +
        '<span class="type-name">' + t + '</span>' +
        '<span class="type-track"><span class="type-bar" style="width:' + width + '%"></span></span>' +
        '<span class="type-count">' + n + '</span>' +
        '</div>';
    }).join('');
}

/* ---------- 列表渲染 ---------- */
/* 严重程度越大越靠前；正文里没写严重程度的排到最后 */
function severityRank(issue) {
  const sev = parseSeverity(issue.body);
  const idx = SEVERITY_ORDER.indexOf(sev);
  return idx === -1 ? SEVERITY_ORDER.length : (SEVERITY_ORDER.length - 1 - idx);
}

const SORTERS = {
  created: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  severity: (a, b) =>
    severityRank(a) - severityRank(b) || (new Date(b.created_at) - new Date(a.created_at)),
  comments: (a, b) =>
    (b.comments || 0) - (a.comments || 0) || (new Date(b.created_at) - new Date(a.created_at)),
  updated: (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
};

/* 列表被截断时的提示：说清只显示了多少条，以及去哪看全部 */
function truncateNoteHtml() {
  if (!state.truncated) return '';
  const ghUrl = 'https://github.com/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/issues?q=is%3Aissue';
  return '<div class="truncate-note">' +
    'ℹ️ 仅加载最近 ' + state.allIssues.length + ' 条报告，更早的请 ' +
    '<a class="err-link" href="' + ghUrl + '" target="_blank" rel="noopener noreferrer">前往 GitHub 查看</a>。' +
    '</div>';
}

export function renderIssues() {
  const container = $('#issuesContainer');
  const countBadge = $('#issueCount');
  const keyword = ($('#searchInput').value || '').trim().toLowerCase();
  const sortKey = $('#sortFilter').value;
  const quick = state.quick || 'all';

  let list = state.allIssues.slice();

  if (quick === 'open') list = list.filter((i) => i.state === 'open');
  else if (quick === 'closed') list = list.filter((i) => i.state === 'closed');
  else if (quick === 'urgent') {
    /* 「紧急」= 未解决 且 严重程度为 严重/致命 */
    list = list.filter((i) => {
      if (i.state !== 'open') return false;
      const sev = parseSeverity(i.body);
      return sev === '严重' || sev === '致命';
    });
  }

  if (keyword) {
    list = list.filter((i) =>
      i.title.toLowerCase().indexOf(keyword) !== -1 ||
      (i.body || '').toLowerCase().indexOf(keyword) !== -1
    );
  }

  list.sort(SORTERS[sortKey] || SORTERS.created);

  /* 有筛选时显示「筛出 / 总数」，避免误以为数据丢了 */
  const totalCount = state.allIssues.length;
  if (list.length === totalCount) {
    countBadge.textContent = totalCount;
    countBadge.classList.remove('is-filtered');
    countBadge.removeAttribute('title');
  } else {
    countBadge.textContent = list.length + ' / ' + totalCount;
    countBadge.classList.add('is-filtered');
    countBadge.title = '共 ' + totalCount + ' 条，当前筛出 ' + list.length + ' 条';
  }

  // 同步 Tab 徽标（用总数，不受筛选影响）
  setIssueCount(state.allIssues.length);

  const note = staleNoteHtml() + truncateNoteHtml();

  if (list.length === 0) {
    if (state.allIssues.length === 0 && state.stale) {
      container.innerHTML = note + '<div class="issues-no-match">🕒 离线缓存里也没有报告，恢复后点「刷新」即可。</div>';
    } else if (state.allIssues.length === 0) {
      container.innerHTML = note +
        '<div class="issues-empty">✨ 还没有人提交过 Bug，快来当第一个吧！' +
        '<div class="empty-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="copyTemplateBtn">' +
            icon('copy') + ' 复制描述模板</button>' +
        '</div></div>';
    } else if (quick === 'urgent') {
      container.innerHTML = note + '<div class="issues-no-match">✅ 当前没有「严重 / 致命」级别的未处理报告。</div>';
    } else {
      container.innerHTML = note + '<div class="issues-no-match">🔍 没有匹配的报告，试试换个关键词或筛选条件。</div>';
    }
    return;
  }

  const html = list.map((issue) => {
    const isOpen = issue.state === 'open';
    const sev = parseSeverity(issue.body);
    const date = new Date(issue.created_at).toLocaleDateString('zh-CN');
    const commentMeta = issue.comments > 0
      ? '<span><span aria-hidden="true">💬</span> ' + issue.comments + '</span>'
      : '';
    const statusText = isOpen ? '未解决' : '已解决';

    return '' +
      '<li class="issue-item ' + (isOpen ? '' : 'closed') + (sev ? ' sev-' + sev : '') + '"' +
      ' role="button" tabindex="0"' +
      ' data-issue="' + issue.number + '"' +
      ' aria-label="#' + issue.number + ' ' + escapeHtml(issue.title) + '（' + statusText +
        (sev ? '，严重程度 ' + sev : '') + '）">' +
        '<span class="issue-status" aria-hidden="true">' + (isOpen ? '🟢' : '⚪') + '</span>' +
        '<div class="issue-info">' +
          '<div class="issue-title">' + escapeHtml(issue.title) + '</div>' +
          '<div class="issue-meta">' +
            '<span class="issue-number">#' + issue.number + '</span>' +
            (sev ? '<span class="sev-tag sev-' + sev + '">' + sev + '</span>' : '') +
            '<span><span aria-hidden="true">📅</span> ' + date + '</span>' +
            commentMeta +
          '</div>' +
        '</div>' +
      '</li>';
  }).join('');

  container.innerHTML = note + '<ul class="issues-list">' + html + '</ul>';
}

/* 兜底提示里的「重试」：强制刷新，跳过限流冷却。用委托实现，避免每次重渲染都要重新绑定 */
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (!e.target || e.target.id !== 'staleRetryBtn') return;
    loadIssues({ force: true });
  });
}

/* ---------- 空状态的「复制描述模板」 ---------- */
/* 一条报告都没有时，最难的往往是"不知道该怎么描述"；给一段填空骨架降低门槛 */
const TEMPLATE_TEXT = [
  '**现象**：',
  '',
  '**怎么出现的**：在哪个页面、点了什么操作',
  '',
  '**复现步骤**：',
  '1. ',
  '2. ',
  '3. ',
  '',
  '**期望结果**：',
  '',
  '**实际结果**：'
].join('\n');

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('#copyTemplateBtn') : null;
    if (!btn) return;
    const original = btn.dataset.label || btn.innerHTML;
    btn.dataset.label = original;
    copyText(TEMPLATE_TEXT).then((ok) => {
      btn.innerHTML = ok ? icon('copy') + ' ✅ 已复制' : '❌ 复制失败，可手动写';
      setTimeout(() => { btn.innerHTML = original; }, 1600);
    });
  });
}

/* ---------- 重复检测 ---------- */
/* 这些词几乎每条 Bug 标题里都有，参与匹配只会制造误报 */
const STOPWORDS = [
  'bug', '错误', '问题', '异常', '无法', '不能', '不了', '失败', '显示', '出现',
  '一直', '突然', '然后', '就是', '这个', '那个', '没有', '怎么', '为什么', '求助'
];

export function checkDuplicate() {
  const hint = $('#duplicateHint');
  const raw = $('#bugTitle').value.trim().toLowerCase();

  hint.classList.remove('active');
  hint.innerHTML = '';

  if (raw.length < 2 || state.allIssues.length === 0) return;

  const parts = raw
    .split(/[\s，,。.、\/\\|;；:：!！?？()（）\[\]【】"“”'‘’]+/)
    .filter((w) => w.length >= 2 && STOPWORDS.indexOf(w) === -1);
  const terms = parts.length ? parts : [];

  // 全是停用词（例如只写了"闪退问题"）时不做匹配，避免把整个列表都当成相似
  if (!terms.length) return;

  const scored = [];
  state.allIssues.forEach((issue) => {
    const title = (issue.title || '').toLowerCase();
    let hits = 0;
    terms.forEach((t) => {
      if (title.indexOf(t) !== -1) hits++;
    });
    const score = hits / terms.length;
    if (score >= DUPLICATE_THRESHOLD) scored.push({ issue: issue, score: score });
  });

  if (!scored.length) return;

  scored.sort((a, b) => {
    const aOpen = a.issue.state === 'open' ? 0 : 1;
    const bOpen = b.issue.state === 'open' ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return b.issue.number - a.issue.number;
  });

  const matched = scored.slice(0, 3);

  hint.innerHTML =
    '<div>⚠️ <strong>发现 ' + matched.length + ' 条相似报告：</strong></div>' +
    matched.map((item) =>
      '<button type="button" class="dup-link" data-issue="' + item.issue.number + '">' +
        '#' + item.issue.number + ' ' + escapeHtml(item.issue.title) +
      '</button>'
    ).join('') +
    '<div class="dup-tip">如果已有人报告过，建议到对应 Issue 下补充信息。</div>';

  hint.classList.add('active');
}

export const debouncedDuplicate = debounce(checkDuplicate, 250);
