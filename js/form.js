import {
  GITHUB_CONFIG, DRAFT_KEY, NICKNAME_KEY, SUBMIT_LIMIT_KEY, SUBMIT_COOLDOWN_MS
} from './config.js';
import { $, readLocal, writeLocal, removeLocal } from './utils.js';

/* ---------- 严重程度（单选组） ---------- */
const SEVERITY_VALUES = ['轻微', '一般', '严重', '致命'];

export function getSeverity() {
  const checked = document.querySelector('input[name="severity"]:checked');
  return checked ? checked.value : '一般';
}

export function setSeverity(value) {
  const target = SEVERITY_VALUES.indexOf(value) !== -1 ? value : '一般';
  const radios = document.querySelectorAll('input[name="severity"]');
  Array.prototype.forEach.call(radios, (radio) => {
    radio.checked = radio.value === target;
  });
}

/* ---------- 昵称记忆 ---------- */
/* 只记昵称，不记邮箱：邮箱会公开显示，留存在本地反而容易误填 */
export function rememberNickname() {
  const name = ($('#nickname').value || '').trim();
  if (name) writeLocal(NICKNAME_KEY, name);
}

export function restoreNickname() {
  const field = $('#nickname');
  if (!field || field.value.trim()) return;
  const name = readLocal(NICKNAME_KEY);
  if (typeof name === 'string' && name.trim()) field.value = name.trim();
}

/* ---------- 草稿 ---------- */
let lastDraftSnapshot = '';

export function getFormData() {
  return {
    nickname: $('#nickname').value,
    email: $('#email').value,
    bugTitle: $('#bugTitle').value,
    bugType: $('#bugType').value,
    env: $('#env').value,
    severity: getSeverity(),
    bugDescription: $('#bugDescription').value,
    steps: $('#steps').value,
    screenshot: $('#screenshot').value
  };
}

export function hasDraftContent(data) {
  return !!(data && (
    data.nickname || data.email || data.bugTitle || data.bugDescription ||
    data.steps || data.screenshot
  ));
}

export function saveDraft() {
  const data = getFormData();
  if (!hasDraftContent(data)) {
    // 全为空 —— 主动清掉旧草稿，避免下次误提示"恢复空草稿"
    if (lastDraftSnapshot) {
      removeLocal(DRAFT_KEY);
      lastDraftSnapshot = '';
    }
    return;
  }
  const snap = JSON.stringify(data);
  if (snap === lastDraftSnapshot) return;
  lastDraftSnapshot = snap;
  writeLocal(DRAFT_KEY, data);
}

export function loadDraftFromStorage() {
  return readLocal(DRAFT_KEY);
}

export function discardDraft() {
  removeLocal(DRAFT_KEY);
  lastDraftSnapshot = '';
}

export function applyDraftToForm(data) {
  if (!data) return;
  $('#nickname').value = data.nickname || '';
  $('#email').value = data.email || '';
  $('#bugTitle').value = data.bugTitle || '';
  $('#bugType').value = data.bugType || '界面显示';
  $('#env').value = data.env || '未说明';
  setSeverity(data.severity);
  $('#bugDescription').value = data.bugDescription || '';
  $('#steps').value = data.steps || '';
  $('#screenshot').value = data.screenshot || '';
  // 让后续 saveDraft 以"恢复后的状态"为起点，避免立刻触发一次无谓写入
  lastDraftSnapshot = JSON.stringify(getFormData());
}

/* ---------- 字数统计 ---------- */
export function updateCounter(inputId, counterId, max) {
  const el = document.getElementById(inputId);
  const counter = document.getElementById(counterId);
  if (!el || !counter) return;
  const len = el.value.length;
  counter.textContent = len + ' / ' + max;
  counter.classList.remove('warn', 'over');
  if (len >= max) counter.classList.add('over');
  else if (len >= max * 0.9) counter.classList.add('warn');
}

export function updateAllCounters() {
  updateCounter('bugTitle', 'titleCounter', 80);
  updateCounter('bugDescription', 'descCounter', 1000);
  updateCounter('steps', 'stepsCounter', 600);
  updateCounter('screenshot', 'screenshotCounter', 2000);
}

/* ---------- 内联错误 ---------- */
/* 这些输入框除了错误信息外，本来就带一段常态说明，清错误时要还原回去 */
const DEFAULT_DESCRIBEDBY = {
  bugTitle: 'titleCounter',
  email: 'emailPrivacyHint',
  screenshot: 'screenshotCounter'
};

export function showFieldError(el, message) {
  if (!el) return;
  clearFieldError(el);
  const errId = el.id + 'Error';
  const p = document.createElement('p');
  p.className = 'field-error';
  p.id = errId;
  p.textContent = message;
  el.classList.add('invalid');
  el.setAttribute('aria-invalid', 'true');
  el.setAttribute('aria-describedby', errId);
  el.insertAdjacentElement('afterend', p);
}

export function clearFieldError(el) {
  if (!el || !el.id) return;
  el.classList.remove('invalid');
  el.removeAttribute('aria-invalid');
  const describedBy = DEFAULT_DESCRIBEDBY[el.id];
  if (describedBy) el.setAttribute('aria-describedby', describedBy);
  else el.removeAttribute('aria-describedby');
  const err = document.getElementById(el.id + 'Error');
  if (err) err.remove();
}

export function validateForm() {
  const rules = [
    { id: 'nickname', test: (v) => v.trim().length > 0, msg: '请填写你的昵称' },
    { id: 'email', test: (v) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), msg: '邮箱格式不正确，请检查' },
    { id: 'bugTitle', test: (v) => v.trim().length >= 4, msg: 'Bug 简要描述至少需要 4 个字' },
    { id: 'bugDescription', test: (v) => v.trim().length >= 10, msg: '详细描述至少需要 10 个字' }
  ];

  for (const rule of rules) {
    const el = document.getElementById(rule.id);
    if (!el) continue;
    if (!rule.test(el.value)) {
      showFieldError(el, rule.msg);
      el.focus();
      return { ok: false, field: el, message: rule.msg };
    }
    clearFieldError(el);
  }
  return { ok: true };
}

/* ---------- Issue 构造 ---------- */
export function buildIssueBody() {
  const nickname = $('#nickname').value.trim();
  const email = $('#email').value.trim() || '(未填写)';
  const bugType = $('#bugType').value;
  const env = $('#env').value;
  const severity = getSeverity();
  const bugDesc = $('#bugDescription').value.trim();
  const steps = $('#steps').value.trim() || '(未填写)';
  const screenshot = $('#screenshot').value.trim();

  const lines = [
    '### 🐞 Bug 描述', '', bugDesc, '',
    '### 📋 复现步骤', '', steps, '',
    '### 📊 问题信息', '',
    '- **问题类型**：' + bugType,
    '- **严重程度**：' + severity,
    '- **运行环境**：' + env, ''
  ];

  if (screenshot) {
    lines.push('### 🖼️ 截图 / 日志', '', screenshot, '');
  }

  lines.push(
    '### 👤 报告者信息', '',
    '- **昵称**：' + nickname,
    '- **联系邮箱**：' + email, '',
    '---',
    '*由微信twu Bug汇报站提交 — ' + new Date().toLocaleString('zh-CN') + '*'
  );

  return lines.join('\n');
}

export function buildIssueUrl() {
  const title = $('#bugTitle').value.trim();
  const body = buildIssueBody();
  const base = 'https://github.com/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/issues/new';
  const params = new URLSearchParams({
    title: '[Bug] ' + title,
    body: body,
    labels: GITHUB_CONFIG.labels.join(',')
  });
  return base + '?' + params.toString();
}

/* ---------- 提交限流 ---------- */
export function checkRateLimit() {
  const last = readLocal(SUBMIT_LIMIT_KEY);
  if (!last) return { ok: true };
  const elapsed = Date.now() - Number(last);
  if (elapsed < SUBMIT_COOLDOWN_MS) {
    return { ok: false, remain: Math.ceil((SUBMIT_COOLDOWN_MS - elapsed) / 1000) };
  }
  return { ok: true };
}

export function recordSubmitTime() {
  writeLocal(SUBMIT_LIMIT_KEY, Date.now());
}

/* ---------- 清空表单字段 ---------- */
export function resetFormFields() {
  ['nickname', 'email', 'bugTitle', 'bugDescription', 'steps', 'screenshot'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = '';
      clearFieldError(el);
    }
  });
  $('#bugType').value = '界面显示';
  $('#env').value = '未说明';
  setSeverity('一般');
}
