/* 对 js/ 下所有文件做语法检查（不引入 ESLint 依赖，CI 跑得又快又稳） */
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = readdirSync('js').filter((f) => f.endsWith('.js')).sort();

if (!files.length) {
  console.error('js/ 目录下没有找到 .js 文件');
  process.exit(1);
}

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', 'js/' + file], { stdio: 'pipe' });
  } catch (e) {
    console.error('语法错误：js/' + file);
    console.error(e.stderr ? e.stderr.toString() : e.message);
    process.exit(1);
  }
}

console.log('语法检查通过，共 ' + files.length + ' 个文件');
