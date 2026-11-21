import { GITHUB_CONFIG } from './config.js';
import { $, escapeHtml, copyText } from './utils.js';
import { state } from './store.js';
import { renderMarkdown } from './markdown.js';
import { fetchIssueDetail, fetchComments } from './api.js';

/* ---------- 深链：?issue=5 ---------- */
function syncUrlIssue(number) {
  try {
    const url = new URL(window.location.href);
    if (number) url.searchParams.set('issue', String(number));
    else url.searchParams.delete('issue');
    const next = url.pathname + (url.search || '') + (url.hash || '');
    window.history.replaceState(null, '', next);
  } catch (e) { /* 隐私模式等场景下不可用，忽略 */ }
}

export function issueShareUrl(number) {
  return window.location.origin + window.location.pathname + '?issue=' + number;
}

/* 复制当前报告的单条链接 */
export async function copyIssueLink() {
  const n = state.currentModalNumber;
  if (!n) return false;
  return copyText(issueShareUrl(n));
}

/* 复制当前报告的 Markdown 摘要，方便粘到群里讨论 */
export async function copyIssueMarkdown() {
  const issue = state.currentIssue;
  if (!issue) return false;
  const statusText = issue.state === 'open' ? '未解决' : '已解决';
  const date = new Date(issue.created_at).toLocaleDateString('zh-CN');
  const md = [
    '## ' + issue.title,
    '',
    '> #' + issue.number + ' · ' + statusText + ' · ' + date,
    '',
    (issue.body || '(无描述)'),
    '',
    '原帖：' + (issue.html_url || issueShareUrl(issue.number))
  ].join('\n');
  return copyText(md);
}

function flashCopyFeedback(btn, ok) {
  if (!btn) return;
  const original = btn.dataset.originalLabel || btn.innerHTML;
  btn.dataset.originalLabel = original;
  btn.innerHTML = ok ? '✅ 已复制' : '❌ 复制失败';
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = original;
    btn.disabled = false;
  }, 1600);
}

export function copyLinkWithFeedback(btn) {
  copyIssueLink().then((ok) => flashCopyFeedback(btn, ok));
}

export function copyMarkdownWithFeedback(btn) {
  copyIssueMarkdown().then((ok) => flashCopyFeedback(btn, ok));
}

/* ---------- 滚动锁 ----------
 * 只用 overflow:hidden 在 iOS Safari 上常常锁不住，
 * 这里改成 position:fixed + 记录滚动位置，关闭后精确还原。
 */
let savedScrollY = 0;
let scrollLocked = false;

function lockScroll() {
  if (scrollLocked) return;
  savedScrollY = window.scrollY || window.pageYOffset || 0;
  const body = document.body;
  body.style.position = 'fixed';
  body.style.top = '-' + savedScrollY + 'px';
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  /* 补偿消失的滚动条宽度，避免弹窗打开时页面横向抖动 */
  const gap = window.innerWidth - document.documentElement.clientWidth;
  if (gap > 0) body.style.paddingRight = gap + 'px';
  scrollLocked = true;
}

function unlockScroll() {
  if (!scrollLocked) return;
  const body = document.body;
  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.right = '';
  body.style.width = '';
  body.style.overflow = '';
  body.style.paddingRight = '';
  scrollLocked = false;
  window.scrollTo(0, savedScrollY);
}

/* 弹窗打开时把主内容设为 inert：读屏与 Tab 不会再穿到背景 */
function setBackgroundInert(on) {
  const card = $('.bug-report-card');
  if (!card) return;
  if (on) card.setAttribute('inert', '');
  else card.removeAttribute('inert');
}

export function openModal() {
  const modal = $('#issueModal');
  state.lastFocusedElement = document.activeElement;
  modal.classList.add('active');
  lockScroll();
  setBackgroundInert(true);
  const closeBtn = $('#modalCloseBtn');
  if (closeBtn) closeBtn.focus();
}

export function closeModal() {
  const modal = $('#issueModal');
  if (!modal.classList.contains('active')) return;
  modal.classList.remove('active');
  setBackgroundInert(false);
  unlockScroll();
  state.currentModalNumber = null;
  state.currentIssue = null;
  syncUrlIssue(0);
  if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function') {
    state.lastFocusedElement.focus();
  }
  state.lastFocusedElement = null;
}

export function trapFocus(e) {
  const modal = $('#issueModal');
  const nodes = modal.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  const focusables = Array.prototype.filter.call(nodes, (el) =>
    el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
  );
  if (!focusables.length) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function renderModalContent(issue) {
  $('#modalTitle').textContent = issue.title;

  const isOpen = issue.state === 'open';
  const statusText = isOpen ? '未解决' : '已解决';
  const labels = (issue.labels || [])
    .map((l) => '<span class="label-chip">' + escapeHtml(l.name) + '</span>').join('');

  $('#modalMeta').innerHTML =
    '<span>#' + issue.number + '</span>' +
    '<span><span aria-hidden="true">' + (isOpen ? '🟢' : '⚪') + '</span> ' + statusText + '</span>' +
    '<span><span aria-hidden="true">📅</span> ' + new Date(issue.created_at).toLocaleString('zh-CN') + '</span>' +
    '<span><span aria-hidden="true">💬</span> ' + (issue.comments || 0) + ' 条评论</span>' +
    labels;

  $('#modalBody').innerHTML = issue.body
    ? renderMarkdown(issue.body)
    : '<p class="muted">(无描述)</p>';

  const ghLink = $('#modalGithubLink');
  ghLink.href = issue.html_url ||
    ('https://github.com/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/issues/' + issue.number);
}

function renderComment(c) {
  const user = c.user || {};
  const avatar = user.avatar_url
    ? '<img class="comment-avatar" src="' + escapeHtml(user.avatar_url) + '" alt="" width="28" height="28" loading="lazy">'
    : '<span class="comment-avatar" aria-hidden="true"></span>';

  return '' +
    '<div class="comment-item">' +
      avatar +
      '<div class="comment-main">' +
        '<div class="comment-head">' +
          '<strong>' + escapeHtml(user.login || '匿名用户') + '</strong>' +
          '<time>' + new Date(c.created_at).toLocaleString('zh-CN') + '</time>' +
        '</div>' +
        '<div class="comment-body">' + renderMarkdown(c.body || '') + '</div>' +
      '</div>' +
    '</div>';
}

async function loadComments(number) {
  const wrap = $('#modalComments');
  wrap.innerHTML = '<div class="comments-loading">⏳ 正在加载评论…</div>';

  let list;
  try {
    list = await fetchComments(number);
  } catch (e) {
    if (state.currentModalNumber !== number) return;
    wrap.innerHTML = '<div class="comments-empty">评论加载失败，可点击下方按钮前往 GitHub 查看。</div>';
    return;
  }

  if (state.currentModalNumber !== number) return;

  if (!list.length) {
    wrap.innerHTML = '';
    return;
  }

  const shown = list.slice(0, 10);
  wrap.innerHTML =
    '<div class="comments-title"><span aria-hidden="true">💬</span> 评论（' + shown.length + '）</div>' +
    shown.map(renderComment).join('');
}

export async function openIssueModal(issueNumber) {
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) return;   // 防御性校验

  const cached = state.allIssues.find((i) => i.number === issueNumber);

  state.currentModalNumber = issueNumber;
  state.currentIssue = cached || null;

  $('#modalTitle').textContent = '加载中…';
  $('#modalMeta').innerHTML = '';
  $('#modalBody').innerHTML = '<div class="comments-loading">⏳ 正在加载详情…</div>';
  $('#modalComments').innerHTML = '';
  $('#modalGithubLink').href =
    'https://github.com/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/issues/' + issueNumber;

  openModal();
  syncUrlIssue(issueNumber);     // 地址栏带上 ?issue=N，方便直接分享

  if (cached) renderModalContent(cached);

  try {
    const data = await fetchIssueDetail(issueNumber);
    if (state.currentModalNumber === issueNumber) {
      state.currentIssue = data;
      renderModalContent(data);
    }
  } catch (e) {
    if (state.currentModalNumber === issueNumber && !cached) {
      $('#modalBody').innerHTML =
        '<div class="issues-error">详情加载失败，请点击下方按钮前往 GitHub 查看。</div>';
    }
  }

  if (state.currentModalNumber === issueNumber) loadComments(issueNumber);
}
