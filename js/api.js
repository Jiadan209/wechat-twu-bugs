import {
  GITHUB_CONFIG, CACHE_TTL, ISSUE_PAGE_SIZE, ISSUE_MAX_PAGES,
  ISSUES_CACHE_KEY, ISSUES_ETAG_KEY, COMMENTS_CACHE_PREFIX
} from './config.js';
import { readSession, writeSession, removeSession } from './utils.js';

const API_BASE = 'https://api.github.com/repos/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo;
const JSON_HEADERS = { 'Accept': 'application/vnd.github+json' };
const FETCH_TIMEOUT_MS = 15000;

/*
 * 统一错误类型：保留堆栈（instanceof Error 成立），
 * 调用方既可以读 type 分支，也可以读 message 直接展示。
 */
export class ApiError extends Error {
  constructor(type, meta) {
    super(type);
    this.name = 'ApiError';
    this.type = type;
    Object.assign(this, meta || {});
  }
}

export function isConfigValid() {
  return GITHUB_CONFIG.owner.trim() !== '' && GITHUB_CONFIG.repo.trim() !== '';
}

export function classifyError(res) {
  const remaining = res.headers.get('x-ratelimit-remaining');
  if (res.status === 403 && remaining === '0') {
    const resetTs = Number(res.headers.get('x-ratelimit-reset') || 0) * 1000;
    const minutes = resetTs > Date.now()
      ? Math.max(1, Math.ceil((resetTs - Date.now()) / 60000))
      : 60;
    return new ApiError('rate-limit', { minutes, status: res.status });
  }
  if (res.status === 404) return new ApiError('not-found', { status: res.status });
  return new ApiError('http', { status: res.status });
}

export function cacheRemainMs() {
  const cached = readSession(ISSUES_CACHE_KEY);
  if (!cached || !cached.ts) return 0;
  return Math.max(0, CACHE_TTL - (Date.now() - cached.ts));
}

/* 带超时的 fetch —— 避免网络挂起时永远 loading */
async function safeFetch(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
  } catch (e) {
    if (e && e.name === 'AbortError') throw new ApiError('timeout');
    throw new ApiError('network');
  } finally {
    clearTimeout(timer);
  }
}

/* 从 Link 响应头里取 rel="next" 的地址 */
function nextPageUrl(res) {
  const link = res.headers.get('Link');
  if (!link) return null;
  const parts = link.split(',');
  for (let i = 0; i < parts.length; i++) {
    if (/rel="next"/.test(parts[i])) {
      const m = parts[i].match(/<([^>]+)>/);
      if (m) return m[1];
    }
  }
  return null;
}

function readEtag() {
  try { return sessionStorage.getItem(ISSUES_ETAG_KEY); } catch (e) { return null; }
}

function writeEtag(value) {
  try {
    if (value) sessionStorage.setItem(ISSUES_ETAG_KEY, value);
  } catch (e) { /* 隐私模式下不可用，忽略 */ }
}

function saveIssuesCache(data, truncated) {
  writeSession(ISSUES_CACHE_KEY, { ts: Date.now(), data: data, truncated: !!truncated });
}

/*
 * 拉取 Issue 列表：
 * 1. 5 分钟内直接用 sessionStorage 缓存；
 * 2. 带 If-None-Match，304 直接复用旧数据（GitHub 对 304 不计入限流）；
 * 3. 顺着 Link 头的 next 翻页，最多 ISSUE_MAX_PAGES 页，超出的部分标记 truncated。
 */
export async function fetchIssues(options) {
  const force = !!(options && options.force);
  const cached = readSession(ISSUES_CACHE_KEY);

  if (!force && cached && Date.now() - cached.ts < CACHE_TTL) {
    return { data: cached.data, fromCache: true, truncated: !!cached.truncated };
  }

  const firstUrl = API_BASE + '/issues?state=all&per_page=' + ISSUE_PAGE_SIZE +
    '&sort=created&direction=desc';

  const etag = readEtag();
  const firstHeaders = Object.assign({}, JSON_HEADERS);
  if (etag && cached) firstHeaders['If-None-Match'] = etag;

  let res = await safeFetch(firstUrl, { headers: firstHeaders });

  if (res.status === 304) {
    if (cached) {
      // 数据没变：只刷新时间戳，避免重复拉取
      saveIssuesCache(cached.data, cached.truncated);
      return { data: cached.data, fromCache: true, truncated: !!cached.truncated };
    }
    // 本地缓存丢了但 ETag 还在：清掉 ETag 再完整取一次（不递归，避免自调用）
    removeSession(ISSUES_ETAG_KEY);
    res = await safeFetch(firstUrl, { headers: JSON_HEADERS });
  }

  if (!res.ok) throw classifyError(res);

  const collected = [];
  let truncated = false;
  let pageRes = res;
  let pageCount = 1;

  while (pageRes) {
    const batch = await pageRes.json();
    if (Array.isArray(batch)) collected.push.apply(collected, batch);

    const next = nextPageUrl(pageRes);
    if (!next) break;
    if (pageCount >= ISSUE_MAX_PAGES) { truncated = true; break; }

    // 后续页失败时保留已拿到的数据，只提示列表可能不全
    try {
      const nextRes = await safeFetch(next, { headers: JSON_HEADERS });
      if (!nextRes.ok) { truncated = true; break; }
      pageRes = nextRes;
      pageCount += 1;
    } catch (e) {
      truncated = true;
      break;
    }
  }

  writeEtag(res.headers.get('ETag'));
  saveIssuesCache(collected, truncated);
  return { data: collected, fromCache: false, truncated: truncated };
}

export async function fetchIssueDetail(number) {
  const res = await safeFetch(API_BASE + '/issues/' + number, { headers: JSON_HEADERS });
  if (!res.ok) throw classifyError(res);
  return res.json();
}

export async function fetchComments(number) {
  const key = COMMENTS_CACHE_PREFIX + number;
  const cached = readSession(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const res = await safeFetch(
    API_BASE + '/issues/' + number + '/comments?per_page=10',
    { headers: JSON_HEADERS }
  );
  if (!res.ok) throw classifyError(res);
  const data = await res.json();
  writeSession(key, { ts: Date.now(), data: data });
  return data;
}
