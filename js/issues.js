import { GITHUB_CONFIG } from './config.js';
import { $, escapeHtml, debounce } from './utils.js';
import { state } from './store.js';
import { fetchIssues, isConfigValid, cacheRemainMs } from './api.js';
import { setIssueCount } from './tab.js';

let refreshLabelTimer = null;
let loadVersion = 0;

/* ---------- 骨架屏 / 错误 ---------- */
function renderSkeleton(container) {
  container.innerHTML =
    '<div class="skeleton-list" aria-hidden="true">' +
    new Array(4).join('<div class="skeleton-row"></div>') +
    '<div class="skeleton-row"></div>' +
    '</div>';
}

function renderIssuesError(err) {
  const container = $('#issuesContainer');
  const ghUrl = 'https://github.com/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/issues';
  const link = '<br><a class="err-link" href="' + ghUrl + '" target="_blank" rel="noopener noreferrer">前往 GitHub Issues 页面 →</a>';

  let html;
  if (err && err.type === 'rate-limit') {
    html = '⏳ GitHub API 触发限流，预计约 <strong>' + err.minutes +
      ' 分钟</strong>后恢复，请稍后再刷新。' + link;
  } else if (err && err.type === 'not-found') {
    html = '❌ 仓库不存在或为私有仓库，无法读取 Issue 列表。' + link;
  } else if (err && err.type === 'timeout') {
    html = '⏱️ 请求超时，请检查网络后重新刷新。' + link;
  } else if (err && err.type === 'network') {
    html = '📡 网络异常，无法连接 GitHub。请检查网络后重新刷新。';
  } else {
    const status = err && err.status ? err.status : '未知';
    html = '❌ 加载失败（状态码 ' + escapeHtml(status) + '）。' + link;
  }

  container.innerHTML = '<div class="issues-error">' + html + '</div>';
}

/* ---------- 刷新按钮的缓存倒计时 ---------- */
function scheduleRefreshLabel() {
  clearInterval(refreshLabelTimer);
  const paint = () => {
    const btn = $('#refreshBtn');
    if (!btn || btn.disabled) return;
    const remain = cacheRemainMs();
    const minutes = remain > 0 ? Math.ceil(remain / 60000) : 0;
    btn.innerHTML = minutes > 0
      ? '<span aria-hidden="true">🔄</span> 刷新 (' + minutes + ')'
      : '<span aria-hidden="true">🔄</span> 刷新';
    if (minutes <= 0) clearInterval(refreshLabelTimer);
  };
  paint();
  refreshLabelTimer = setInterval(paint, 10000);
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
  btn.innerHTML = '<span aria-hidden="true">⏳</span> 加载中';
  container.setAttribute('aria-busy', 'true');
  renderSkeleton(container);

  try {
    const result = await fetchIssues({ force });
    if (myVersion !== loadVersion) return;          // 有更新的请求在途，丢弃本次结果
    state.allIssues = result.data.filter((item) => !item.pull_request);
    updateStats(state.allIssues);
    renderIssues();
    checkDuplicate();
  } catch (err) {
    if (myVersion !== loadVersion) return;
    console.error('加载 Issues 失败:', err);
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
}

/* ---------- 列表渲染 ---------- */
const SORTERS = {
  created: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  comments: (a, b) =>
    (b.comments || 0) - (a.comments || 0) || (new Date(b.created_at) - new Date(a.created_at)),
  updated: (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
};

export function renderIssues() {
  const container = $('#issuesContainer');
  const countBadge = $('#issueCount');
  const keyword = ($('#searchInput').value || '').trim().toLowerCase();
  const stateFilter = $('#stateFilter').value;
  const sortKey = $('#sortFilter').value;

  let list = state.allIssues.slice();

  if (stateFilter !== 'all') list = list.filter((i) => i.state === stateFilter);

  if (keyword) {
    list = list.filter((i) =>
      i.title.toLowerCase().indexOf(keyword) !== -1 ||
      (i.body || '').toLowerCase().indexOf(keyword) !== -1
    );
  }

  list.sort(SORTERS[sortKey] || SORTERS.created);
  countBadge.textContent = list.length;

  // 同步 Tab 徽标（用总数，不受筛选影响）
  setIssueCount(state.allIssues.length);

  if (list.length === 0) {
    if (state.allIssues.length === 0) {
      container.innerHTML = '<div class="issues-empty">✨ 还没有人提交过 Bug，快来当第一个吧！</div>';
    } else {
      container.innerHTML = '<div class="issues-no-match">🔍 没有匹配的报告，试试换个关键词或筛选条件。</div>';
    }
    return;
  }

  const html = list.map((issue) => {
    const isOpen = issue.state === 'open';
    const date = new Date(issue.created_at).toLocaleDateString('zh-CN');
    const commentMeta = issue.comments > 0
      ? '<span><span aria-hidden="true">💬</span> ' + issue.comments + '</span>'
      : '';
    const statusText = isOpen ? '未解决' : '已解决';

    return '' +
      '<li class="issue-item ' + (isOpen ? '' : 'closed') + '" role="button" tabindex="0"' +
      ' data-issue="' + issue.number + '"' +
      ' aria-label="#' + issue.number + ' ' + escapeHtml(issue.title) + '（' + statusText + '）">' +
        '<span class="issue-status" aria-hidden="true">' + (isOpen ? '🟢' : '⚪') + '</span>' +
        '<div class="issue-info">' +
          '<div class="issue-title">' + escapeHtml(issue.title) + '</div>' +
          '<div class="issue-meta">' +
            '<span class="issue-number">#' + issue.number + '</span>' +
            '<span><span aria-hidden="true">📅</span> ' + date + '</span>' +
            commentMeta +
          '</div>' +
        '</div>' +
      '</li>';
  }).join('');

  container.innerHTML = '<ul class="issues-list">' + html + '</ul>';
}

/* ---------- 重复检测 ---------- */
export function checkDuplicate() {
  const hint = $('#duplicateHint');
  const raw = $('#bugTitle').value.trim().toLowerCase();

  hint.classList.remove('active');
  hint.innerHTML = '';

  if (raw.length < 2 || state.allIssues.length === 0) return;

  const parts = raw
    .split(/[\s，,。.、\/\\|;；:：!！?？()（）\[\]【】"“”'‘’]+/)
    .filter((w) => w.length >= 2);
  const terms = parts.length ? parts : [raw];

  const scored = [];
  state.allIssues.forEach((issue) => {
    const title = (issue.title || '').toLowerCase();
    const body = (issue.body || '').toLowerCase();
    let hits = 0;
    terms.forEach((t) => {
      if (title.indexOf(t) !== -1 || body.indexOf(t) !== -1) hits++;
    });
    const score = hits / terms.length;
    if (score >= 0.5) scored.push({ issue, score });
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
