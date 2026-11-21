/* 跨模块共享的运行时状态 */
export const state = {
  allIssues: [],
  /* 列表是否因为分页上限而只加载了部分数据 */
  truncated: false,
  lastFocusedElement: null,
  currentModalNumber: null
};
