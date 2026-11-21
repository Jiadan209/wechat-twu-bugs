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
