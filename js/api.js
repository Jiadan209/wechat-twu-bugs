import {
  GITHUB_CONFIG, CACHE_TTL,
  ISSUES_CACHE_KEY, ISSUES_ETAG_KEY, COMMENTS_CACHE_PREFIX
} from './config.js';
import { readSession, writeSession, removeSession } from './utils.js';

const API_BASE = 'https://api.github.com/repos/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo;
const JSON_HEADERS = { 'Accept': 'application/vnd.github+json' };
const FETCH_TIMEOUT_MS = 15000;

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
    return { type: 'rate-limit', minutes };
  }
  if (res.status === 404) return { type: 'not-found' };
  return { type: 'http', status: res.status };
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
    if (e && e.name === 'AbortError') throw { type: 'timeout' };
    throw { type: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchIssues(options) {
  const force = !!(options && options.force);
  const cached = readSession(ISSUES_CACHE_KEY);

  if (!force && cached && Date.now() - cached.ts < CACHE_TTL) {
    return { data: cached.data, fromCache: true };
  }

  const url = API_BASE + '/issues?state=all&per_page=50&sort=created&direction=desc';
  const headers = Object.assign({}, JSON_HEADERS);

  const etag = (() => {
    try { return sessionStorage.getItem(ISSUES_ETAG_KEY); } catch (e) { return null; }
  })();
  if (etag && cached) headers['If-None-Match'] = etag;

  const res = await safeFetch(url, { headers });

  if (res.status === 304) {
    if (cached) {
      writeSession(ISSUES_CACHE_KEY, { ts: Date.now(), data: cached.data });
      return { data: cached.data, fromCache: true };
    }
    removeSession(ISSUES_ETAG_KEY);
    return fetchIssues({ force: true });
  }

  if (!res.ok) throw classifyError(res);

  const data = await res.json();
  const newEtag = res.headers.get('ETag');
  if (newEtag) {
    try { sessionStorage.setItem(ISSUES_ETAG_KEY, newEtag); } catch (e) {}
  }
  writeSession(ISSUES_CACHE_KEY, { ts: Date.now(), data });
  return { data, fromCache: false };
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
  writeSession(key, { ts: Date.now(), data });
  return data;
}
