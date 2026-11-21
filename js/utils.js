/* 通用工具：DOM 选择、防抖、转义、存储读写 */
export const $ = (sel, root) => (root || document).querySelector(sel);

export function debounce(fn, wait) {
  let timer = null;
  return function () {
    const ctx = this;
    const args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
  };
}

export function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function readSession(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function writeSession(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

export function removeSession(key) {
  try { sessionStorage.removeItem(key); } catch (e) {}
}

export function readLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

export function removeLocal(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}

/* 内联 SVG 图标：统一引用 index.html 里的 <symbol> 雪碧图，避免各平台 emoji 渲染差异 */
export function icon(name, extraClass) {
  return '<svg class="icon-svg' + (extraClass ? ' ' + extraClass : '') +
    '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"></use></svg>';
}

/* 复制文本：优先用异步剪贴板，不可用时退回隐藏 textarea + execCommand */
export async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* 权限被拒时走兜底 */ }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}
