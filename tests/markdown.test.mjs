import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../js/markdown.js';

test('HTML 标签被转义，不能注入', () => {
  const html = renderMarkdown('<img src=x onerror=alert(1)>');
  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes('&lt;img'), true);
});

test('script 标签同样被转义', () => {
  const html = renderMarkdown('<script>alert(1)</script>');
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
});

test('只把 https 链接变成 <a>，javascript 协议被拒绝', () => {
  const ok = renderMarkdown('见 [文档](https://example.com/a)');
  assert.match(ok, /<a href="https:\/\/example\.com\/a"[^>]*>文档<\/a>/);

  const bad = renderMarkdown('[点我](javascript:alert(1))');
  assert.equal(bad.includes('<a '), false);
});

test('标题、粗体、行内代码', () => {
  assert.equal(renderMarkdown('## 标题').includes('<h2>标题</h2>'), true);
  assert.equal(renderMarkdown('这是 **重点**').includes('<strong>重点</strong>'), true);
  assert.equal(renderMarkdown('用 `npm test` 跑').includes('<code class="md-code">npm test</code>'), true);
});

test('无序列表与有序列表', () => {
  const ul = renderMarkdown('- 第一\n- 第二');
  assert.equal(ul, '<ul><li>第一</li><li>第二</li></ul>');

  const ol = renderMarkdown('1. 打开\n2. 点击');
  assert.equal(ol, '<ol><li>打开</li><li>点击</li></ol>');
});

test('代码块保持原文，且不做行内替换', () => {
  const html = renderMarkdown('```\nconst a = **b**;\n```');
  assert.equal(html, '<pre class="md-pre"><code>const a = **b**;</code></pre>');
});

test('CRLF 换行被归一化，段落正常拆分', () => {
  const html = renderMarkdown('第一行\r\n第二行');
  assert.equal(html, '<p>第一行</p>\n<p>第二行</p>');
});

test('空输入不炸', () => {
  assert.equal(renderMarkdown(''), '');
  assert.equal(renderMarkdown(null), '');
  assert.equal(renderMarkdown(undefined), '');
});
