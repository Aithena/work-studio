# work-studio 项目地图

本地优先工作台：**左 Todo，右笔记（AiEditor）**。单页、无登录、无路由、无 Pinia。

新会话：先按下面路径打开文件，不要全库扫描。产品规格在 `.codex/技术实现规范.md`，不要当代码入口。

## 双轨：本机调试 + CF 正式

| 轨 | 用途 | 入口 |
| --- | --- | --- |
| 本机 | 开发/调试；开机可自启 Node | `http://127.0.0.1:18900`（`pnpm dev` 或自启脚本） |
| CF | 正式访问；Tauri 套壳也指向这里 | `https://work.awall.cc` |

两边数据独立（本机 SQLite vs D1/R2），不自动同步；需要时用导入导出 zip。

## 栈与端口

- 前端：Vue 3 + Vite + Element Plus + Less → `http://127.0.0.1:18900`
- 后端：Hono + better-sqlite3 → `http://127.0.0.1:8787`（Vite 把 `/api` 代理过去）
- 桌面：Tauri 2 套壳，加载 `https://work.awall.cc`（不打包后端）
- 云端：Worker + D1 + R2 + Assets → `worker/`、`wrangler.toml`
- 数据（本机）：`data/note.db`，上传 `data/uploads/`，备份 `data/backups/`
- 开发：`pnpm dev`（同时起 server + web）；部署：`pnpm cf:deploy`

## 按功能找文件

| 要改什么 | 先读 |
| --- | --- |
| 主布局 / 分栏 / Ctrl+S | `src/views/WorkspaceView.vue` |
| 左栏 Todo UI | `src/components/TodoPanel.vue` → `TodoItem` / `TodoFilterBar` / `TodoContextMenu` / `TodoImportDialog` |
| Todo 状态与 API 调用 | `src/composables/useTodos.ts` → `src/api/todos.ts` → `server/todos.ts` |
| 优先级排序 | `src/utils/todoPriority.ts` |
| 右栏笔记 UI | `src/components/NoteEditor.vue`（AiEditor） |
| 笔记切换 / 自动保存 | `src/composables/useNote.ts` → `src/api/note.ts` → `server/notes.ts` |
| 顶栏按钮（搜索/日志/AI 记录/导入导出/设置/快捷链接） | `src/components/WorkbenchActions.vue` |
| 活动热力图 | `src/components/ActivityHeatmap.vue` → `src/api/activity.ts` → `server/activity.ts` |
| 设置 / 强调色 | `src/components/SettingsDialog.vue`、`src/composables/useAccent.ts` |
| 导入导出 zip | `src/components/DataTransferDialog.vue` → `src/api/backup.ts` → `server/backup.ts` |
| 分栏比例 | `src/components/SplitPane.vue`、`src/composables/useSplitRatio.ts` |
| 类型 | `src/types/index.ts` |
| 样式 token | `src/styles/tokens.less` → `base.less` / `element.less` / `editor.less` |
| HTTP 入口 / 路由表 | `server/index.ts` |
| SQLite schema / 迁移补列 | `server/db.ts` |
| AI 代理（编辑器对话） | `server/ai.ts`（`AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL`） |
| AI 调用记录 | `src/components/AiCallLogDialog.vue` → `src/api/ai.ts` → `server/ai-logs.ts`；表 `ai_calls` |
| 图片上传 | `server/uploads.ts`（返回 AiEditor 的 `errorCode` 结构，不走 `{ success }`） |
| Tauri 窗口 / 外链 Chrome | `src-tauri/src/lib.rs`、`src-tauri/tauri.conf.json` |
| 开机/桌面快捷方式 | `scripts/start-workbench.ps1`、`autostart.ps1`、`desktop-shortcut.ps1` |
| CF Worker / 鉴权 / 路由 | `worker/index.ts` → `worker/app.ts`；D1 迁移 `worker/migrations/` |
| CF 部署 | `wrangler.toml`；`pnpm cf:deploy`；secrets：`ACCESS_TOKEN`、`AI_API_KEY` |

## 约定

- API 一律 `{ success: true, data }` / `{ success: false, message }`，例外：`POST /api/image/upload`
- Todo 删除是软删；回收站再 `purge`；还有 `hidden` 字段
- 笔记 debounce 500ms 自动保存；当前笔记 id 在 `localStorage` 的 `workbench.current-note-id`
- 活动刷新靠 `window` 事件 `workbench:activity`；搜索靠 `workbench:search`（Ctrl+K）
- 前端多用相对路径 import；Vite 有 `@` → `src` 别名但现有代码几乎不用
- 本机轨：不要引入路由、Pinia、ORM；CF 轨用 D1/R2，与本机库分开
