/* Tab 切换（≤960px 生效；桌面端 Tab 栏被 CSS 隐藏，双栏并存） */
import { $ } from './utils.js';

const TAB_KEY = 'wechat_twu_active_tab';
const ORDER = ['form', 'issues'];
const ID_MAP = { form: 'tabForm', issues: 'tabIssues' };

let currentTab = 'form';

/* 由 issues.js 调用，更新「已有报告」tab 上的计数徽标 */
export function setIssueCount(n) {
  const el = $('#tabIssueCount');
  if (!el) return;
  el.textContent = n > 0 ? '(' + n + ')' : '';
}

export function activateTab(name, options) {
  if (ORDER.indexOf(name) === -1) name = 'form';
  currentTab = name;

  const grid = $('#mainGrid');
  if (grid) grid.dataset.tab = name;
  document.body.dataset.activeTab = name;

  ORDER.forEach((key) => {
    const btn = document.getElementById(ID_MAP[key]);
    if (!btn) return;
    const selected = key === name;
    btn.classList.toggle('active', selected);
    btn.setAttribute('aria-selected', String(selected));
    btn.tabIndex = selected ? 0 : -1;
  });

  try { sessionStorage.setItem(TAB_KEY, name); } catch (e) {}

  if (options && options.scroll &&
      window.matchMedia('(max-width: 960px)').matches) {
    const body = $('.card-body');
    if (body) body.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

export function initTabs() {
  const list = $('#tabList');
  if (!list) return;

  let saved = null;
  try { saved = sessionStorage.getItem(TAB_KEY); } catch (e) {}
  activateTab(ORDER.indexOf(saved) !== -1 ? saved : 'form');

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    activateTab(btn.dataset.tab, { scroll: true });
  });

  /* 键盘：← → 切换并聚焦；Home / End 跳到首尾 */
  list.addEventListener('keydown', (e) => {
    const idx = ORDER.indexOf(currentTab);
    let next = null;

    if (e.key === 'ArrowRight') {
      next = ORDER[(idx + 1) % ORDER.length];
    } else if (e.key === 'ArrowLeft') {
      next = ORDER[(idx - 1 + ORDER.length) % ORDER.length];
    } else if (e.key === 'Home') {
      next = ORDER[0];
    } else if (e.key === 'End') {
      next = ORDER[ORDER.length - 1];
    }
    if (!next) return;

    e.preventDefault();
    activateTab(next);
    const btn = document.getElementById(ID_MAP[next]);
    if (btn) btn.focus();
  });
}
