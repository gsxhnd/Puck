# Puck 文档：UI、主题与多语言

## 1. 主窗口布局

```text
┌──────────────────────────────────────────────────────────┐
│ 窗口控制 / 侧栏切换 / 搜索 / Workspace 名称 / 设置        │
├──────────────┬───────────────────────────────────────────┤
│ Workspace    │ Editor tabs：file.rs  config.toml  Graph    │
│ switcher     ├───────────────────────────────────────────┤
│ Files/Git/   │              Monaco Editor                │
│ Ports        │                                           │
│              ├───────────────────────────────────────────┤
│ File tree    │ Terminal tabs：local  ssh  build        + │
│              ├───────────────────────────────────────────┤
│              │              xterm.js                      │
├──────────────┴───────────────────────────────────────────┤
│ path · branch · language · UTF-8 · local/SSH             │
└──────────────────────────────────────────────────────────┘
```

- 左侧栏可折叠：`Cmd/Ctrl+B` 或 `Cmd/Ctrl+Shift+L`。
- 终端可隐藏 / 显示：`Cmd/Ctrl+J`。
- 中央上下分割宽度持久化在 `shell_layout` 的 `editor` / `terminal`。
- 左右分割宽度持久化在 `primary` / `main`。
- 无打开编辑器时显示空状态；终端可以独立占用中央区域。
- 关闭最后一个终端只显示终端空状态，不退出应用。

## 2. Workspace 侧栏

### Workspace switcher

- 打开本地目录：原生 directory dialog。
- 打开 SSH Workspace：从 SSH profiles 选择。
- 管理连接：打开 Connections 窗口。
- 最近打开：最多 12 个，远程 profile 缺失时提示并不恢复。

### Files

- 面包屑；
- 隐藏文件切换；
- 新建文件 / 新建目录；
- 在此处打开终端（本地）；
- 刷新；
- 树节点 hover 重命名 / 删除；
- 双击文件打开 Monaco。
- 删除必须确认。
- 本地与远程 UI 操作一致。

### Git

- 分支、upstream、ahead / behind。
- staged / unstaged / untracked 分组。
- 文件行内 stage / unstage / discard / open diff。
- commit 输入框 + `Cmd/Ctrl+Enter` 提交。
- fetch / pull / push / refresh。
- Git Graph 按钮。
- 本地 watcher 静默刷新；远程依赖操作后刷新与手动刷新。

### Ports

- 仅远程 Workspace 且 SSH connected 后可添加。
- 本地端口支持 `0` 自动分配。
- 显示：
  - 运行状态点；
  - `127.0.0.1:<port>`；
  - `→ remoteHost:remotePort`；
- 操作：复制本地地址、停止转发。
- 失败通过 toast 显示后端结构化错误。
- Workspace 切换时自动停止旧 Workspace 的 forwards。

## 3. 编辑器与 Graph

### Workbench tabs

- Editor：
  - title 为文件名；
  - dirty 显示 `•`；
  - close dirty 前 confirm。
- Diff：
  - 只读；
  - title 为文件名；
  - close 时清理 diff content registry。
- Git Graph：
  - title `Git Graph`；
  - 同一 Workspace 复用同一个 Graph tab。
- 标签按 `workspaceId` 过滤，不显示其他 Workspace 的标签。

### Monaco

- `loadMonaco()` 动态加载：
  - `editor.api.js`
  - `editor.all.js`
  - `monaco-basic-languages.ts`
- 只注册基础 editor worker。
- 不注册 json / css / html / typescript language service worker。
- Monarch 提供基础语法高亮。
- 不提供语义补全、定义跳转、诊断或重构。

### Git Graph 视觉

- SVG 绘制：
  - lane 连接为 cubic curve；
  - 节点为圆点；
  - 颜色循环使用主题 chart token。
- 行内容：
  - short hash；
  - refs（最多显示 3 个）；
  - subject；
  - author；
  - 本地化日期。
- 点击行显示底部详情：
  - full hash；
  - author / date；
  - parents。
- 分页按钮固定底部。

## 4. 终端

- 底部独立 tab bar。
- 新建终端继承 Workspace root。
- 本地支持默认 shell / 指定 shell。
- SSH 支持密码 / 私钥 / 每次询问 / Host Key。
- `Cmd/Ctrl+D` 分屏，修饰键决定方向。
- `Cmd/Ctrl+F` 当前终端搜索，`Cmd/Ctrl+Shift+F` 全部终端搜索。
- xterm 插件：
  - fit；
  - clipboard；
  - web links；
  - search。
- 终端外观与 UI 主题分离。

## 5. 状态栏

左侧：

- Workspace source 图标（远程显示 server icon）；
- 当前编辑器相对路径或 Workspace root；
- dirty 标记。

右侧：

- Git branch（本地 / 远程均支持）；
- Monaco language；
- UTF-8；
- local / remote。

## 6. 多窗口

- `main`：Workspace workbench。
- `settings`：Settings。
- `connections`：Connections。
- 同一 React bundle，通过 `?window=` 选择。
- `puck:config-changed` 驱动跨窗口 rehydrate。
- SSH Profile 从 Connections 请求主窗口打开时，主窗口打开 Workspace / 终端。

## 7. 主题与样式

- Tailwind v4，无 `tailwind.config.js`。
- `src/App.css`：
  - `@import "tailwindcss"`；
  - `@theme` token；
  - shell / titlebar / xterm 样式。
- shadcn/ui `base-nova` 风格，基于 `@base-ui/react`。
- 颜色使用语义 token（`background`、`muted`、`destructive`、`chart-*`），不写死品牌色。
- Light / Dark / System 由设置控制。
- 多套 color theme 由 `themes.rs` 读取并提供给前端 registry。

## 8. 多语言

- 默认 `zh-CN`，fallback `en-US`。
- Namespace：
  - `common`
  - `connections`
  - `terminal`
  - `settings`
  - `errors`
  - `info`
  - `commandPalette`
  - `editor`
- 新增 key 必须同时存在于：
  - `src/i18n/locales/zh-CN/*.json`
  - `src/i18n/locales/en-US/*.json`
- 错误优先用 `errors:<code>` 映射，缺失时回退结构化 message。
- Host Key / Git / 端口转发错误不得直接展示 raw backend string。

## 9. 可访问性

- 图标按钮都有 `aria-label` / tooltip。
- Tab 关闭支持 Enter / Space。
- Dialog 使用 `DialogTitle` / `DialogDescription`。
- 删除 / discard 等不可逆操作必须确认。
- xterm 内按键不拦截编辑器快捷键，`Cmd/Ctrl+S` 检测 `.xterm` target。
