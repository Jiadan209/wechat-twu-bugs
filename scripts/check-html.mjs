/* index.html 基础校验：重复 id、必填结构、引用的 js 文件是否存在 */
import { readFileSync, existsSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const errors = [];

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
if (dup.length) errors.push('存在重复 id：' + dup.join(', '));

if (!/<\/html>\s*$/.test(html)) errors.push('缺少收尾的 </html>');
if (!/<html lang="zh-CN">/.test(html)) errors.push('<html> 缺少 lang="zh-CN"');
if (!/<meta name="viewport"/.test(html)) errors.push('缺少 viewport meta');

const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
for (const src of scripts) {
  if (!existsSync(src)) errors.push('脚本文件不存在：' + src);
}

/* app.js 里用 $('#xxx') 直取的 id 必须在页面上真实存在（动态生成的除外） */
const app = readFileSync('js/app.js', 'utf8');
const dynamicIds = new Set(['rateRemain']);
const literalRefs = [...app.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]);
const missing = [...new Set(literalRefs)].filter(
  (id) => !dynamicIds.has(id) && ids.indexOf(id) === -1
);
if (missing.length) errors.push('app.js 引用了页面上不存在的 id：' + missing.join(', '));

if (errors.length) {
  errors.forEach((e) => console.error('✗ ' + e));
  process.exit(1);
}

console.log('index.html 校验通过：' + ids.length + ' 个 id，' + scripts.length + ' 个脚本引用');
