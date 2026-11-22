/* 全局常量：集中管理，便于部署时调整 */
export const GITHUB_CONFIG = {
  owner: 'Jiadan209',
  repo: 'wechat-twu-bugs',
  labels: ['bug', '微信twu']
};

/* Issue 列表分页：每页条数 × 最多页数 = 单次最多加载的条数，超出部分提示去 GitHub 查看 */
export const ISSUE_PAGE_SIZE = 100;
export const ISSUE_MAX_PAGES = 3;

/* 相似报告检测：标题关键词命中比例达到该值才提示（值越高越不灵敏） */
export const DUPLICATE_THRESHOLD = 0.6;

export const DRAFT_KEY = 'wechat_twu_bug_draft';
export const NICKNAME_KEY = 'wechat_twu_last_nickname';
export const SUBMIT_LIMIT_KEY = 'wechat_twu_last_submit';
export const SUBMIT_COOLDOWN_MS = 3 * 60 * 1000;

export const ISSUES_CACHE_KEY = 'wechat_twu_issues_cache';
export const ISSUES_ETAG_KEY = 'wechat_twu_issues_etag';
export const COMMENTS_CACHE_PREFIX = 'wechat_twu_comments_';
export const RATE_LIMIT_KEY = 'wechat_twu_rate_limit';

/* 缓存有效期：15 分钟内不重新请求，省下 GitHub 的每小时 60 次额度 */
export const CACHE_TTL = 15 * 60 * 1000;

/* 限流/断网时的兜底上限：一天内的旧数据仍可展示，只是标注"可能不是最新" */
export const STALE_MAX_AGE = 24 * 60 * 60 * 1000;
