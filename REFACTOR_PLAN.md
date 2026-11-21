# Puck 重构决策记录

本文记录 2026-11-21 产品重构的决策、结果和后续约束。当前代码以本文为架构基线，旧的三栏 Sessions 工作台、RDP/VNC 骨架和 FTP 占位不再是有效设计。

## 1. 决策总览

| 决策 | 结论 |
| --- | --- |
| 产品定位 | 轻量级本地 / 远程代码工作台，不是完整 IDE |
| LSP / 插件 | 永不提供 |
| 编辑器 | Monaco standalone + Monarch 基础高亮；无 language service worker |
| Tree-sitter | 未来可选高亮增强，不作为插件机制设计 |
| Workspace | 一个窗口一个本地或远程目录，是 Files / Git / Ports / 终端 / 编辑器的共同上下文 |
| 编辑器与终端 | 独立区域、独立标签、独立生命周期，地位相等 |
| SSH | 单 profile 单 authenticated transport，多使用者租约 |
| Git | 本地与远端都使用 Git CLI；不引入 git2 |
| Git Graph | `--all --topo-order` + 前端 lane 布局，分页只读 |
| 端口转发 | 首版只做 loopback local forward（`ssh -L`） |
| FTP / FTPS | 删除协议与占位，历史配置过滤 |
| RDP / VNC | 删除全部骨架、命令、类型、证书链路与 i18n namespace |
| 系统资源监控 / 命令大纲 / 传输队列 | 删除不可达 UI、配置区段、Rust 命令与依赖 |

## 2. 已落地架构

### 2.1 Workspace-first 主窗口

- `src/stores/workspace-store.ts` 保存 active workspace、recents、侧栏视图、终端可见性与远程连接状态。
- `AppShell` 变为左右分割：左侧 Workspace sidebar，中央编辑器 + 底部终端 + 状态栏。
- `WorkbenchTabArea` 与 `WorkspaceTerminal` 分别持有标签。
- 终端 `cd` 不改变 Workspace root。
- 编辑器 / Diff / Graph 标签带 `workspaceId`，切换 Workspace 时不混入隐藏标签。

### 2.2 共享 SSH

`src-tauri/src/ssh.rs`：

- `SharedSshEntry` 保存 handle、owners 和 endpoint 指纹。
- 使用者：
  - workspace base lease；
  - terminal shell channel；
  - SFTP command channel；
  - remote Git short exec channel；
  - each local forward。
- endpoint 变化或 handle 关闭时废弃旧 transport。
- 同 profile connect lock single-flight。
- 所有 release 都幂等；最后一个 owner 才 disconnect。
- SSH open generation 处理 StrictMode / 快速关闭 / 迟到握手。

关键约束：

- terminal / SFTP worker 不允许调用整连接 `disconnect()`；
- 新 IPC 或 channel 使用者必须持有并释放自己的 lease；
- 基础 workspace release 负责停止该 profile 的 forwards。

### 2.3 远程 Git

`src-tauri/src/remote_git.rs`：

- 通过共享 SSH 执行远端 Git。
- workspace path 与参数逐个 POSIX quote。
- 保留原始 stdout，适配 NUL 分隔 status/graph。
- 复用本地 Git parser 与网络错误分类。
- `tauri-git.ts` 根据 `connectionId` 自动切换 local / remote command。

### 2.4 Git Graph

- Rust `git_graph` 输出 hash、author、date、subject、parents、refs。
- `src/lib/git-graph-layout.ts` 是纯 TypeScript lane 布局器。
- `src/components/workspace/git-graph.tsx` 渲染 SVG DAG、refs、详情和分页。
- 首版只读，不提供 rebase / cherry-pick / interactive 操作。

### 2.5 Port forwarding

`src-tauri/src/port_forward.rs`：

- loopback only；
- local port 支持 `0`；
- per-connection direct-tcpip channel；
- supervisor 管理 listener 与 JoinSet relays；
- stop / SSH closed 时完整回收；
- `forward:status` 驱动 UI。

### 2.6 文件与编辑

- 本地写改为 atomic temp + rename。
- 本地新增 mkdir / delete / rename。
- 本地与远程 workspace explorer 支持新建、重命名、删除。
- Remote editor SFTP 保留引用计数。
- `ensureSftpSession()` 增加 in-flight dedup。

## 3. 产品边界 ADR

### ADR-001：不提供 LSP / 插件

原因：

- Puck 目标是轻量编辑器，LSP 会引入跨文件索引、语言 worker、插件 API 和复杂权限面。
- Monaco standalone 当前已满足编辑、Diff 和基础高亮。

约束：

- 不加载 `json` / `css` / `html` / `typescript` language service worker。
- 不添加扩展点、插件 loader、调试器或任务系统。
- Tree-sitter 未来只能作为内置高亮实现，不能成为插件机制。

### ADR-002：Git 使用 CLI 而非 git2

原因：

- 与用户环境行为一致（credential helper、配置、hook、安全更新）。
- 避免引入另一套 Git 认证与网络栈。
- 本地已有经过测试的 porcelain 解析器。

约束：

- 本地命令必须使用参数数组。
- 远端命令必须逐参数 shell quote。
- 必须设置 `GIT_TERMINAL_PROMPT=0`。
- 网络失败必须保留终端降级。

### ADR-003：共享 SSH 使用 owner lease 而非 Weak 全局缓存

原因：

- 前端和后端都需要明确的 Workspace 生命周期。
- Ports 需要在 Workspace 关闭时统一停止。
- owner lease 更容易审计最后释放者，也避免 Weak 意外存活或过早释放。

实现：

- workspace 持有 base lease；
- 每个使用者独立 owner id；
- close / open generation 防止 stale attempt；
- 最终 release 显式 disconnect。

### ADR-004：删除 FTP/FTPS 与 RDP/VNC

原因：

- “即将支持”的占位与轻量定位冲突。
- RDP/VNC 依赖冲突和图形管线成本高，且不是代码工作台核心。
- FTP/FTPS 与 SSH/SFTP 能力重叠，安全维护成本不匹配收益。

处理：

- 协议 union 缩小为 `local | ssh | sftp`。
- rehydrate 过滤历史 unsupported profile。
- 删除 Rust 命令、前端类型、证书 store、dialog 与 i18n namespace。

### ADR-005：删除不可达的辅助面板

原因：

- 旧三栏工作台移除后，系统资源监控、命令大纲和传输队列没有 UI 入口。
- 它们与“轻量级代码工作台”的定位不匹配，继续保留只会增加配置、IPC 和依赖面。

处理：

- 删除 `system_monitor.rs`、`transfer.rs`、命令大纲 store/panel、传输队列 store/UI。
- 移除 `sysinfo` 依赖与 SFTP transfer channel。
- 移除 `sidebar_layout` / `hosts_layout` 配置区段和对应旧侧栏状态 store。
- 远程文件能力保留为 Workspace Explorer + Monaco SFTP 编辑，不做上传下载队列。

## 4. 验收记录

截至本文更新：

```text
npm run build                 ✅
cd src-tauri && cargo check   ✅
cd src-tauri && cargo test    ✅ 23 passed
cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings ✅
```

仍需人工验证：

- macOS / Windows / Linux 本地 PTY 与路径行为。
- 真实 SSH 服务器的 host key、密码、私钥、断线重连。
- 远端 Git 与 local forward 的网络环境测试。
- 大仓库 Graph 分页性能。
