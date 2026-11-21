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
  lastFocusedElement: null,
  currentModalNumber: null
};
