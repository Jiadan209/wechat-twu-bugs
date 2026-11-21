# wechat-twu-bugs

微信 twu（TurboWarp 聊天作品）的 Bug 汇报站。纯静态页面，不需要后端：表单提交时拼出 GitHub 的「新建 Issue」链接，登记的工单全部落在本仓库的 Issues 里。

- 在线访问：https://jiadan209.github.io/wechat-twu-bugs/
- 提交 Bug：站点左栏填表，或直接使用 [Bug 报告模板](https://github.com/Jiadan209/wechat-twu-bugs/issues/new?template=bug_report.yml)
- 查看 Bug：站点右栏可直接搜索、按状态筛选、按时间或评论数排序

## 功能

- **提交**：本地限流（3 分钟内只能提交一次）、草稿自动保存与恢复、字数统计、必填项校验
- **浏览**：4 项统计（总数 / 未解决 / 已解决 / 最近 7 天）、关键词搜索、状态筛选、三种排序
- **详情弹窗**：Markdown 渲染、评论加载、焦点陷阱、`inert` 背景隔离、移动端滚动锁
- **相似报告提醒**：输入标题时实时匹配已有报告的标题，避免重复提交
- **弱网可用**：sessionStorage + ETag 条件请求缓存（304 不计入 GitHub 限流）

## 目录结构

```
index.html                  页面结构与分享元信息
styles.css                  样式（含深浅色主题）
favicon.svg                 站点图标
version.json                版本号（给游戏端做版本检测时读取）
js/
  app.js                    入口：初始化、事件绑定、提交流程编排
  api.js                    GitHub API 封装、缓存、分页、统一错误类型
  config.js                 仓库配置与全局常量（部署时主要改这里）
  form.js                   表单取值、校验、草稿、提交 URL 构造、限流
  issues.js                 Issue 列表加载、统计、筛选、相似报告检测
  modal.js                  详情弹窗、评论加载、滚动锁
  markdown.js               极简 Markdown 渲染（先转义再解析，防注入）
  tab.js                    窄屏下的 Tab 切换
  store.js                  跨模块共享的运行时状态
  utils.js                  DOM/防抖/转义/存储读写等通用工具
scripts/                    自检脚本（语法、HTML 结构），CI 使用
tests/                      单元测试（node:test）
.github/workflows/          CI 与自动打标签
```

## 换成自己的仓库

1. 改 `js/config.js` 里的 `GITHUB_CONFIG.owner` / `repo`（`labels` 也一并改）；
2. 仓库需为**公开**仓库，否则匿名读不到 Issues；
3. Pages 设置：Settings → Pages → Source 选「Deploy from a branch」，分支 `main`、目录 `/ (root)`。

其余常量也都在 `config.js`：

| 常量 | 作用 | 默认值 |
| --- | --- | --- |
| `ISSUE_PAGE_SIZE` | 每次请求的条数 | 100 |
| `ISSUE_MAX_PAGES` | 最多翻几页（超出提示去 GitHub 查看） | 3 |
| `DUPLICATE_THRESHOLD` | 相似报告命中比例阈值 | 0.6 |
| `SUBMIT_COOLDOWN_MS` | 提交冷却时间 | 3 分钟 |
| `CACHE_TTL` | 列表与评论缓存时长 | 5 分钟 |

## 本地运行

页面用了 ES 模块，必须通过 HTTP 打开，直接双击 `index.html` 会因跨源限制加载失败。

```bash
npm run serve          # 等价于 python3 -m http.server 8000
# 打开 http://localhost:8000
```

## 检查与测试

```bash
npm run check          # 语法 + HTML 结构 + 单元测试，CI 跑的就是这套
npm test               # 只跑单元测试
```

CI（`.github/workflows/ci.yml`）在每次 push 到 `main` 和每个 PR 上运行，检查项为：

1. `node --check` 逐个检查 `js/*.js` 语法；
2. `index.html` 的重复 id、必填结构、脚本引用、`app.js` 中用到的 id 是否真实存在；
3. `markdown.js` 与 `utils.js` 的单元测试。

另一个工作流 `auto-label.yml` 会在新 Issue 创建时自动补打 `bug` 与 `微信twu` 标签——因为站点跳转时 URL 里的 `labels` 参数对没有仓库权限的访客不生效。

## 提交与分支

`main` 只接受通过 PR 合入的改动：

```bash
git checkout -b feat/xxx
# 改代码
npm run check
git commit -m "feat: xxx"
git push -u origin feat/xxx
```

PR 描述里写清「改了什么 / 为什么 / 怎么验证」，CI 全绿再合并。

## 隐私说明

本仓库是公开仓库，Issue 内容对所有人可见。站点表单里的「联系邮箱」为选填项，且已在界面上提示会公开显示；Issue 模板同样有醒目提示。

## 版本

当前版本 `v2.3.0`，记录在 `version.json`。

## License

[MIT](LICENSE)
