import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, debounce, readLocal, readSession } from '../js/utils.js';

test('escapeHtml 覆盖五个敏感字符', () => {
  assert.equal(
    escapeHtml('<a href="x">\'&\'</a>'),
    '&lt;a href=&quot;x&quot;&gt;&#039;&amp;&#039;&lt;/a&gt;'
  );
});

test('escapeHtml 对 null / undefined 返回空串', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(0), '0');
});

test('debounce 连续调用只执行一次', async () => {
  let calls = 0;
  const fn = debounce(() => { calls += 1; }, 20);
  fn();
  fn();
  fn();
  assert.equal(calls, 0);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(calls, 1);
});

test('debounce 保留最后一次的 this 与参数', async () => {
  let seen = null;
  const obj = {
    value: 1,
    fn: debounce(function (a, b) { seen = [this && this.value, a, b]; }, 20)
  };
  obj.fn(2, 3);
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(seen, [1, 2, 3]);
});

test('存储读取在无 storage 环境下安全返回 null', () => {
  assert.equal(readLocal('不存在的键'), null);
  assert.equal(readSession('不存在的键'), null);
});
