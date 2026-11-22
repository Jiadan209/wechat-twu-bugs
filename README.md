# wechat-twu-bugs

微信 twu（TurboWarp 聊天作品）的 Bug 汇报站。纯静态页面，不需要后端：表单提交时拼出 GitHub 的「新建 Issue」链接，登记的工单全部落在本仓库的 Issues 里。

- 在线访问：https://jiadan209.github.io/wechat-twu-bugs/
- 提交 Bug：站点左栏填表，或直接使用 [Bug 报告模板](https://github.com/Jiadan209/wechat-twu-bugs/issues/new?template=bug_report.yml)
- 查看 Bug：站点右栏可直接搜索、按状态筛选、按时间或评论数排序

## 功能

- **提交**：本地限流（3 分钟内只能提交一次）、草稿自动保存与恢复、字数统计、必填项校验；跳转 GitHub 时已预填标题、正文与标签，无需重复敲一遍
- **浏览**：4 项统计（总数 / 未解决 / 已解决 / 最近 7 天）、问题类型分布横条（无数据时自动隐藏）、最近 7 天新增柱图、关键词搜索、快捷筛选（全部 / 未解决 / 紧急 / 已解决）、四种排序（含「最严重优先」）；带筛选时徽标显示「筛出 / 总数」；列表一次渲染 20 条，剩下的用「显示更多」追加
- **详情弹窗**：Markdown 渲染、评论加载、焦点陷阱、`inert` 背景隔离、移动端滚动锁；可一键「复制链接」或「复制 Markdown」，链接即深链；弹窗底部列出标题相近的「可能相关」报告，点一下直接跳过去
- **深链分享**：点开任一报告后地址栏变为 `?issue=N`，把链接发给别人，对方打开就直接落到那条报告
- **筛选可分享**：筛选、搜索、排序会写进地址栏（`?chip=urgent&q=关键词&sort=severity`），把「筛好的视图」直接发给别人
- **键盘快捷键**：非输入状态下 `/` 聚焦搜索框、`↑↓` 在报告列表间移动焦点；弹窗内 `Esc` 关闭
- **常用记忆**：提交过的昵称存在本地，下次自动填回（邮箱不记，避免误公开）
- **空状态引导**：一条报告都没有时，提供「复制描述模板」，把填空骨架一键复制到剪贴板
- **版本可见**：页脚读取 `version.json` 显示当前版本号，便于对照问题
- **相似报告提醒**：输入标题时实时匹配已有报告的标题，避免重复提交
- **弱网可用**：sessionStorage + ETag 条件请求缓存（304 不计入 GitHub 限流），限流或断网时优先展示旧缓存并标注时间
- **分享预览**：`og:image` 指向 `assets/og-image.jpg`（1200×630），转发链接时显示站点卡片
- **手机端**：≤960px 切换 Tab 视图，右下角悬浮「去填写」按钮随时回表单；图标全部为内联 SVG，跨系统显示一致

## 目录结构

```
index.html                  页面结构、分享元信息、SVG 图标雪碧图
styles.css                  样式（含深浅色主题）
favicon.svg                 站点图标
assets/og-image.jpg         分享卡片（og:image，1200×630）
version.json                版本号（给游戏端做版本检测时读取）
js/
  app.js                    入口：初始化、事件绑定、提交流程编排、快捷键
  api.js                    GitHub API 封装、缓存、分页、统一错误类型
  config.js                 仓库配置与全局常量（部署时主要改这里）
  form.js                   表单取值、校验、草稿、昵称记忆、提交 URL 构造、限流
  issues.js                 Issue 列表加载、统计、趋势图、类型分布、分页、筛选、相似报告
  modal.js                  详情弹窗、评论加载、深链同步、复制链接 / Markdown、可能相关
  markdown.js               极简 Markdown 渲染（先转义再解析，防注入）
  tab.js                    窄屏下的 Tab 切换
  store.js                  跨模块共享的运行时状态（含分页上限）
  utils.js                  DOM/防抖/转义/存储读写/剪贴板/SVG 图标等通用工具
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
| `CACHE_TTL` | 列表缓存时长（到期才重新请求，省 GitHub 额度） | 15 分钟 |
| `STALE_MAX_AGE` | 限流 / 断网时旧缓存还能用多久 | 24 小时 |

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

另一个工作流 `auto-label.yml` 在 Issue 被创建或编辑时补打标签：

- 固定补 `bug` 与 `微信twu`——站点跳转时 URL 里的 `labels` 参数对没有仓库权限的访客不生效；
- 再按正文里的 `**严重程度**` 字段打上 `sev:轻微` / `sev:一般` / `sev:严重` / `sev:致命`，标签不存在时先自动创建。

注意：站点上的「紧急」筛选用的是正文解析（因为匿名访客设不了标签），标签只是给 GitHub 侧分类用。

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

本仓库是公开仓库，Issue 内容对所有人可见。站点表单里的「联系邮箱」为选填项，且已在界面上提示会公开显示；Issue 模板同样有醒目提示。站点只在本地保存「上次用的昵称」用于回填，不保存邮箱。

## 版本

当前版本 `v2.8.0`，记录在 `version.json`。

| 版本 | 主要内容 |
| --- | --- |
| v2.8.0 | 分享卡片 `assets/og-image.jpg`（1200×630），微信 / 聊天软件转发时显示预览图 |
| v2.7.0 | 列表「显示更多」分页、最近 7 天新增柱图、弹窗「可能相关」推荐、键盘快捷键（/ 搜索、↑↓ 移动） |
| v2.6.0 | 严重程度排序、筛选计数、昵称记忆、空状态描述模板、页脚版本号、筛选状态进 URL |
| v2.5.0 | 一条报告都没有时隐藏「问题类型分布」，避免五条空横条占版面 |
| v2.4.0 | 深链分享、严重程度自动标签、问题类型分布、复制链接 / Markdown、移动端悬浮按钮、emoji 换 SVG |
| v2.3.1 | 限流 / 断网时用旧缓存兜底，并给出恢复时间与重试入口 |
| v2.3.0 | 严重程度色块、快捷筛选、截图字段、运行环境下拉、邮箱隐私提示 |
| v2.2.0 及以前 | 表单提交、列表浏览、详情弹窗、相似报告提醒、草稿保存 |

## License

[MIT](LICENSE)
