/* 入口：初始化、事件绑定、提交编排 */
import { $, debounce } from './utils.js';
import { isConfigValid } from './api.js';
import { initTabs } from './tab.js';
import * as form from './form.js';
import * as issues from './issues.js';
import * as modal from './modal.js';

let rateLimitTimer = null;

/* ---------- 限流 Toast ---------- */
function showRateLimitToast(remain) {
  const container = $('#messageContainer');
  clearInterval(rateLimitTimer);
  let left = remain;

  container.innerHTML =
    '<div class="toast-message toast-error">' +
      '<span aria-hidden="true">⏳</span>' +
      '<div><strong>提交太频繁啦～</strong><br>请等待 <strong id="rateRemain">' + left + '</strong> 秒后再试。</div>' +
    '</div>';

  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  rateLimitTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(rateLimitTimer);
      container.innerHTML = '';
      return;
    }
    const node = document.getElementById('rateRemain');
    if (node) node.textContent = String(left);
  }, 1000);
}

/* ---------- 提交 ---------- */
function submitToGitHub() {
  const result = form.validateForm();
  if (!result.ok) return;

  const rl = form.checkRateLimit();
  if (!rl.ok) {
    showRateLimitToast(rl.remain);
    return;
  }

  if (!isConfigValid()) {
    $('#messageContainer').innerHTML =
      '<div class="toast-message toast-error"><span aria-hidden="true">⚠️</span>' +
      '<div>GitHub 仓库尚未配置，暂时无法提交。</div></div>';
    return;
  }

  const issueUrl = form.buildIssueUrl();

  const container = $('#messageContainer');
  const submitBtn = $('#submitBtn');
  const originalText = submitBtn.innerHTML;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span aria-hidden="true">⏳</span> 正在跳转…';

  /*
   * 不能用 window.open(url, '_blank', 'noopener,...')：
   * 带 noopener 特性时规范要求返回 null，会被误判为"被拦截"。
   * 这里拿到引用后立即把 opener 置 null。
   */
  let opened = null;
  try {
    opened = window.open(issueUrl, '_blank');
    if (opened) {
      try { opened.opener = null; } catch (e) { /* 某些浏览器可能禁止访问 */ }
    }
  } catch (e) {
    opened = null;
  }

  if (!opened) {
    // 真正被拦截 —— 恢复按钮，让用户立即点手动链接
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
    container.innerHTML =
      '<div class="toast-message toast-error">' +
        '<span aria-hidden="true">🚫</span>' +
        '<div><strong>浏览器拦截了弹出窗口</strong><br>' +
        '请 <a href="' + issueUrl + '" target="_blank" rel="noopener noreferrer" ' +
        'class="toast-link">点击此链接手动打开 GitHub Issues 页面</a>。</div>' +
      '</div>';
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  // 只有确认打开了新窗口才记录提交时间
  form.recordSubmitTime();

  container.innerHTML =
    '<div class="toast-message toast-info">' +
      '<span aria-hidden="true">🔗</span>' +
      '<div><strong>正在打开 GitHub Issues 页面…</strong><br>' +
      '如果浏览器没有自动跳转，请 <a href="' + issueUrl + '" target="_blank" rel="noopener noreferrer" ' +
      'class="toast-link">点击此链接手动打开</a>。<br>' +
      '<span class="toast-tip">在 GitHub 页面上确认后点 "Submit new issue" 发布。</span></div>' +
    '</div>';

  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  let settled = false;

  const restoreButton = () => {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  };

  const onFocusBack = () => {
    if (settled) return;
    settled = true;
    window.removeEventListener('focus', onFocusBack);
    // 延迟 3 秒：给用户从新窗口切回的缓冲；返回即视为已提交
    setTimeout(() => {
      restoreButton();
      form.discardDraft();
      issues.loadIssues({ force: true });
    }, 3000);
  };

  window.addEventListener('focus', onFocusBack);

  // 30 秒兜底：仅恢复按钮，不清草稿
  setTimeout(() => {
    if (settled) return;
    settled = true;
    window.removeEventListener('focus', onFocusBack);
    restoreButton();
  }, 30000);
}

/* ---------- 清空 ---------- */
function clearForm() {
  form.resetFormFields();
  clearInterval(rateLimitTimer);
  $('#messageContainer').innerHTML = '';

  const hint = $('#duplicateHint');
  hint.classList.remove('active');
  hint.innerHTML = '';

  form.updateAllCounters();
  form.discardDraft();
  $('#draftNotice').classList.remove('active');
  $('#nickname').focus();
}

/* ---------- 草稿 ---------- */
function restoreDraftFromStorage() {
  const data = form.loadDraftFromStorage();
  if (!form.hasDraftContent(data)) return;
  form.applyDraftToForm(data);
  form.updateAllCounters();
  issues.checkDuplicate();
  $('#draftNotice').classList.remove('active');
}

function discardDraftFromStorage() {
  form.discardDraft();
  $('#draftNotice').classList.remove('active');
}

/* ---------- 事件绑定 ---------- */
function bindEvents() {
  $('#bugReportForm').addEventListener('submit', (e) => {
    e.preventDefault();
    submitToGitHub();
  });

  $('#clearBtn').addEventListener('click', clearForm);
  $('#refreshBtn').addEventListener('click', () => issues.loadIssues({ force: true }));

  $('#searchInput').addEventListener('input', debounce(() => issues.renderIssues(), 250));

  $('#sortFilter').addEventListener('change', () => issues.renderIssues());

  /* ---- 快捷筛选芯片：点一下切换筛选条件 ---- */
  $('#quickChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    issues.setQuickFilter(chip.dataset.chip);
  });

  /* ---- 表单输入：统一一个监听器 ---- */
  const COUNTER_CONFIG = {
    bugTitle: ['titleCounter', 80],
    bugDescription: ['descCounter', 1000],
    steps: ['stepsCounter', 600],
    screenshot: ['screenshotCounter', 2000]
  };
  const FORM_FIELDS = [
    'nickname', 'email', 'bugTitle', 'bugType', 'env',
    'bugDescription', 'steps', 'screenshot'
  ];

  FORM_FIELDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const handleInput = () => {
      form.clearFieldError(el);
      const counter = COUNTER_CONFIG[id];
      if (counter) form.updateCounter(id, counter[0], counter[1]);
      if (id === 'bugTitle') issues.debouncedDuplicate();
      $('#draftNotice').classList.remove('active');
      form.saveDraft();
    };
    el.addEventListener('input', handleInput);
    el.addEventListener('change', handleInput);
  });

  /* ---- 严重程度是单选组，单独监听 ---- */
  Array.prototype.forEach.call(
    document.querySelectorAll('input[name="severity"]'),
    (radio) => {
      radio.addEventListener('change', () => {
        $('#draftNotice').classList.remove('active');
        form.saveDraft();
      });
    }
  );

  $('#restoreDraftBtn').addEventListener('click', restoreDraftFromStorage);
  $('#discardDraftBtn').addEventListener('click', discardDraftFromStorage);

  /* ---- 列表点击 -> 弹窗 ---- */
  const issuesContainer = $('#issuesContainer');
  issuesContainer.addEventListener('click', (e) => {
    const item = e.target.closest('.issue-item');
    if (item) modal.openIssueModal(Number(item.dataset.issue));
  });
  issuesContainer.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const item = e.target.closest('.issue-item');
    if (!item) return;
    e.preventDefault();
    modal.openIssueModal(Number(item.dataset.issue));
  });

  $('#duplicateHint').addEventListener('click', (e) => {
    const btn = e.target.closest('.dup-link');
    if (btn) modal.openIssueModal(Number(btn.dataset.issue));
  });

  /* ---- 弹窗 ---- */
  $('#modalCloseBtn').addEventListener('click', modal.closeModal);
  $('#modalFooterCloseBtn').addEventListener('click', modal.closeModal);
  $('#issueModal').addEventListener('click', (e) => {
    if (e.target.id === 'issueModal') modal.closeModal();
  });

  document.addEventListener('keydown', (e) => {
    const m = $('#issueModal');
    if (!m.classList.contains('active')) return;
    if (e.key === 'Escape') {
      modal.closeModal();
      return;
    }
    if (e.key === 'Tab') modal.trapFocus(e);
  });

  /* 页面隐藏时只清定时器；不写草稿（避免覆盖 discardDraft 的结果） */
  window.addEventListener('pagehide', () => {
    clearInterval(rateLimitTimer);
  });
}

/* ---------- 初始化 ---------- */
function init() {
  bindEvents();
  initTabs();
  form.updateAllCounters();

  const draft = form.loadDraftFromStorage();
  if (form.hasDraftContent(draft)) {
    $('#draftNotice').classList.add('active');
  }

  issues.loadIssues();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
