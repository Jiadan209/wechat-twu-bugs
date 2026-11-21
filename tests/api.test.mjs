import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/* 极简 sessionStorage 替身：测试只关心读写行为，不依赖真实浏览器 */
const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear()
};

const { fetchIssues, rateLimitState } = await import('../js/api.js');
const { ISSUES_CACHE_KEY } = await import('../js/config.js');

let calls = 0;

function mockFetch(handler) {
  calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return handler();
  };
}

function rateLimitResponse(minutes) {
  return new Response('', {
    status: 403,
    headers: {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + minutes * 60)
    }
  });
}

function seedCache(ageMs, data) {
  store.set(ISSUES_CACHE_KEY, JSON.stringify({ ts: Date.now() - ageMs, data: data, truncated: false }));
}

const MINUTE = 60 * 1000;
const sample = [{ number: 5, title: '[Bug] 其实没Bug', state: 'open' }];

beforeEach(() => {
  store.clear();
  calls = 0;
  delete globalThis.fetch;
});

test('15 分钟内的缓存直接复用，不发请求', async () => {
  seedCache(2 * MINUTE, sample);
  mockFetch(() => { throw new Error('不应该发请求'); });

  const res = await fetchIssues();
  assert.equal(calls, 0);
  assert.equal(res.fromCache, true);
  assert.equal(res.stale, undefined);
  assert.deepEqual(res.data, sample);
});

test('限流时用旧缓存兜底，并标注剩余分钟', async () => {
  seedCache(40 * MINUTE, sample);
  mockFetch(() => rateLimitResponse(3));

  const res = await fetchIssues();
  assert.equal(calls, 1);
  assert.equal(res.stale, true);
  assert.deepEqual(res.data, sample);
  assert.ok(res.minutes >= 2 && res.minutes <= 3, '分钟数应在 2~3 之间，实际 ' + res.minutes);
  assert.ok(res.cachedAt > 0);
  assert.equal(rateLimitState().active, true);
});

test('冷却期内不再发请求，直接返回兜底数据', async () => {
  seedCache(40 * MINUTE, sample);
  mockFetch(() => rateLimitResponse(5));
  await fetchIssues();          // 第一次撞限流，写入冷却
  assert.equal(calls, 1);

  const res = await fetchIssues();   // 非强制刷新
  assert.equal(calls, 1, '冷却期内不应再发请求');
  assert.equal(res.stale, true);
  assert.deepEqual(res.data, sample);
});

test('手动强制刷新会跳过冷却，重新请求', async () => {
  seedCache(40 * MINUTE, sample);
  mockFetch(() => rateLimitResponse(5));
  await fetchIssues();
  assert.equal(calls, 1);

  await fetchIssues({ force: true });
  assert.equal(calls, 2);
});

test('没有缓存又撞上限流时抛 rate-limit 错误', async () => {
  mockFetch(() => rateLimitResponse(7));

  await assert.rejects(
    () => fetchIssues(),
    (err) => err.name === 'ApiError' && err.type === 'rate-limit' && err.minutes === 7
  );
});

test('超过一天的旧缓存不再兜底，直接报错', async () => {
  seedCache(25 * 60 * MINUTE, sample);
  mockFetch(() => rateLimitResponse(9));

  await assert.rejects(
    () => fetchIssues(),
    (err) => err.type === 'rate-limit'
  );
});

test('断网时同样用旧缓存兜底，但不标注限流分钟', async () => {
  seedCache(40 * MINUTE, sample);
  mockFetch(() => { throw new TypeError('network failed'); });

  const res = await fetchIssues();
  assert.equal(res.stale, true);
  assert.equal(res.minutes, 0);
  assert.deepEqual(res.data, sample);
});
