import { GITHUB_CONFIG } from './config.js';
import { $, escapeHtml } from './utils.js';
import { state } from './store.js';
import { renderMarkdown } from './markdown.js';
import { fetchIssueDetail, fetchComments } from './api.js';

export function openModal() {
  const modal = $('#issueModal');
  state.lastFocusedElement = document.activeElement;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  const closeBtn = $('#modalCloseBtn');
  if (closeBtn) closeBtn.focus();
}

export function closeModal() {
  const modal = $('#issueModal');
  if (!modal.classList.contains('active')) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
  state.currentModalNumber = null;
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

  $('#modalTitle').textContent = '加载中…';
  $('#modalMeta').innerHTML = '';
  $('#modalBody').innerHTML = '<div class="comments-loading">⏳ 正在加载详情…</div>';
  $('#modalComments').innerHTML = '';
  $('#modalGithubLink').href =
    'https://github.com/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/issues/' + issueNumber;

  openModal();

  if (cached) renderModalContent(cached);

  try {
    const data = await fetchIssueDetail(issueNumber);
    if (state.currentModalNumber === issueNumber) renderModalContent(data);
  } catch (e) {
    if (state.currentModalNumber === issueNumber && !cached) {
      $('#modalBody').innerHTML =
        '<div class="issues-error">详情加载失败，请点击下方按钮前往 GitHub 查看。</div>';
    }
  }

  if (state.currentModalNumber === issueNumber) loadComments(issueNumber);
}
