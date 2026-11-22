/* 跨模块共享的运行时状态 */
export const state = {
  allIssues: [],
  /* 列表是否因为分页上限而只加载了部分数据 */
  truncated: false,
  /* 当前展示的是不是限流/断网时兜底的旧缓存 */
  stale: false,
  /* 兜底缓存的生成时间戳 */
  cachedAt: 0,
  /* 因限流兜底时，距恢复还剩几分钟 */
  staleMinutes: 0,
  /* 快捷筛选：all / open / urgent / closed */
  quick: 'all',
  /* 列表一次渲染多少条，「显示更多」会把它调大 */
  renderLimit: 20,
  lastFocusedElement: null,
  currentModalNumber: null,
  /* 当前弹窗对应的 Issue 对象（用于复制 Markdown） */
  currentIssue: null
};
