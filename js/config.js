/* 全局常量：集中管理，便于部署时调整 */
export const GITHUB_CONFIG = {
  owner: 'Jiadan209',
  repo: 'wechat-twu-bugs',
  labels: ['bug', '微信twu']
};

export const DRAFT_KEY = 'wechat_twu_bug_draft';
export const SUBMIT_LIMIT_KEY = 'wechat_twu_last_submit';
export const SUBMIT_COOLDOWN_MS = 3 * 60 * 1000;

export const ISSUES_CACHE_KEY = 'wechat_twu_issues_cache';
export const ISSUES_ETAG_KEY = 'wechat_twu_issues_etag';
export const COMMENTS_CACHE_PREFIX = 'wechat_twu_comments_';
export const CACHE_TTL = 5 * 60 * 1000;
