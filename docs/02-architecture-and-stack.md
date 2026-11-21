# Puck 文档：架构与技术栈

## 1. 技术栈

| 层级 | 技术 | 责任 |
| --- | --- | --- |
| 桌面壳 | Tauri v2 | 窗口、菜单、权限、IPC、打包 |
| 后端 | Rust + tokio | PTY、SSH、SFTP、Git、端口转发、配置、安全边界 |
| 前端 | React 19 + TypeScript + Vite | Workspace UI、状态、Monaco / xterm 容器 |
| UI | shadcn/ui 风格 + Tailwind v4 + lucide-react | 组件、主题 token、布局 |
| 终端 | xterm.js | shell 渲染、输入、搜索、链接 |
| 编辑器 | Monaco standalone | 编辑、Diff、基础语法高亮；无 LSP |
| 状态 | Zustand + persist | Workspace、布局、连接与设置 |
| 国际化 | i18next | `zh-CN` / `en-US` |

Rust 关键依赖：

- `portable-pty`：本地 PTY；
- `russh` / `russh-keys`：SSH transport、认证、channel；
- `russh-sftp`：远程文件读写与目录操作；
- `tokio`：异步 I/O、TCP listener、relay；
- `notify`：本地 workspace watcher；
- `keyring`：系统钥匙串。

## 2. 分层架构

```text
React Workspace Shell
├── WorkspaceSidebar
│   ├── Explorer
│   ├── Source Control
│   └── Ports
├── WorkbenchTabArea
│   ├── Monaco Editor / Diff
│   └── Git Graph
├── WorkspaceTerminal
│   └── xterm.js panes / splits
└── StatusBar

Tauri IPC
├── terminal.rs     local PTY sessions
├── ssh.rs          shared SSH connection + shell channels
├── sftp.rs         SFTP file / directory channels
├── git.rs          local Git CLI
├── remote_git.rs   remote Git CLI over SSH
├── port_forward.rs ssh -L listener + relays
├── workspace.rs    local files
├── config.rs       config.toml sections
└── credential.rs   OS keychain
```

## 3. Workspace 状态模型

`src/stores/workspace-store.ts`：

- `activeWorkspace`：本地 / 远端工作区；
- `recentWorkspaces`：最近 12 个；
- `sidebarView`：`explorer | git | ports`；
- `sidebarOpen`、`terminalOpen`；
- `remoteStatus`：远程基础租约状态，不持久化。

作用域规则：

- 终端 `Session.workspaceId` 决定底部标签归属。
- 编辑器 / Diff / Git Graph 标签保存 `workspaceId`，`workbenchTabsForWorkspace()` 过滤当前视图。
- Workspace root 决定 Files、Git、Ports 和新终端默认目录。
- 终端 OSC 7 更新终端自身 cwd 与标签，但不修改 Workspace root。

## 4. 共享 SSH 连接

### 数据结构

`src-tauri/src/ssh.rs` 内部：

```text
SharedSshEntry
├── Arc<russh client Handle>
├── owners: HashSet<owner_id>
└── endpoint: host / port / username / auth / key path
```

同一个 profile 只有一条 authenticated transport。endpoint 不匹配或 handle 已关闭时，旧 transport 被显式断开并重新认证。

### 租约

| 使用者 | owner 形式 |
| --- | --- |
| 远程 Workspace | `workspace:<workspaceId>` |
| SSH terminal | `terminal:<sessionId>:<generation>` |
| SFTP session | `sftp:<sessionId>:<generation>` |
| Port forward | `<forwardId>` |

- `acquire_shared_ssh()` 幂等加入 owner 集合。
- `release_shared_ssh()` 只有最后一个 owner 才 disconnect。
- Workspace release 前先调用 `stop_forwards_for_connection()`。
- terminal / SFTP worker 绝不直接 disconnect 共享 Handle。

### 并发与迟连接

- 每个 profile 有异步 single-flight connect lock。
- 每次 SSH open 有 generation。
- `close_session` / cleanup 递增 generation。
- 迟到的旧 attempt 在 channel 建立前后都会检测并释放自己的 lease，不会覆盖新连接。

### SSH exec

- Remote Git 使用 `exec_remote_command_on_connection(connection_id, command)`。
- exec command 输出保留原始 stdout，Git NUL 协议不被 trim 破坏。
- stderr 只用于构造非零退出错误。

## 5. 本地 / 远程文件与编辑

### 本地

- `workspace.rs`：
  - `list_local_dir`
  - `read_local_file`
  - `write_local_file`（atomic temp + rename）
  - `mkdir_local`
  - `delete_local`
  - `rename_local`
- `notify` watcher 驱动 Files 与 Git 静默刷新。

### 远程

- SFTP open 在共享 SSH 上建立一个文件操作 / 编辑器读写 channel。
- SFTP command loop 处理 list / mkdir / remove / rename / read / write。
- Editor remote document 使用 `editor:<connectionId>` 独立 SFTP 逻辑 session，并保留前端引用计数。
- Workspace explorer 使用 `workspace:<workspaceId>__explorer` 稳定逻辑 session。
- `ensureSftpSession()` 有同 sessionId in-flight Promise，避免并发重复打开。

## 6. Git 架构

### 本地

- `git.rs` 使用参数数组调用本机 `git`。
- `GIT_TERMINAL_PROMPT=0`。
- status 使用 `--porcelain=v2 -z --branch`。
- log 使用 US/RS 分隔符。
- graph 使用 `--all --topo-order` + `%P` + `%D`。
- 解析器是纯函数并带单元测试。

### 远程

- `remote_git.rs` 通过共享 SSH 执行远端 `git`。
- workspace path 与所有参数逐个 POSIX shell quote。
- `~` / `~/...` 使用 quoted `$HOME` 展开，避免本地路径假设。
- 网络错误复用本地分类器：`auth` / `no_upstream` / `network`。
- 前端 `tauri-git.ts` 根据 `connectionId` 自动选择 local / remote command。

### Graph

- `git_graph` 每页最多 500 条，默认 200。
- `src/lib/git-graph-layout.ts` 计算 lane、edge 和 laneCount。
- `src/components/workspace/git-graph.tsx` 用 SVG 绘制连接与节点。
- 分页 append 后整页重算，保证跨页 DAG 一致。

## 7. 端口转发

`src-tauri/src/port_forward.rs`：

1. 校验 forward id、目标 host / port。
2. 校验本地 bind 是 loopback。
3. `lease_shared_ssh()` 获取租约。
4. `TcpListener::bind`，本地端口 `0` 支持自动分配。
5. supervisor `select!`：
   - stop watch；
   - 周期检查 SSH handle closed；
   - accept；
   - JoinSet 回收 relay。
6. 每个连接调用 `channel_open_direct_tcpip()`，`into_stream()` 后 `copy_bidirectional()`。
7. 停止时 `JoinSet::shutdown().await`，释放 lease，移除 registry，发送 `forward:status`。

## 8. IPC 与事件

### 主要命令

| 命令 | 用途 |
| --- | --- |
| `open_local_terminal` / `open_ssh_terminal` | 打开本地 / 远端 shell channel |
| `open_file_connection` | 打开 SFTP 逻辑 session |
| `ensure_ssh_connection` / `release_ssh_connection` | Workspace 基础租约 |
| `git_*` | 本地 Git |
| `remote_git_*` | 远端 Git |
| `start_local_port_forward` / `stop_local_port_forward` / `list_local_port_forwards` | 端口转发 |
| `read_local_file` / `write_local_file` | 编辑器本地 IO |
| `read_remote_file_command` / `write_remote_file_command` | 编辑器远程 IO |

### 事件

| 事件 | 用途 |
| --- | --- |
| `terminal:data` / `terminal:exit` | 终端输出与退出 |
| `session:status` | SSH / SFTP 状态、失败、Host Key |
| `forward:status` | 端口转发运行 / 停止 / 失败 |
| `puck:config-changed` | 跨窗口配置同步 |
| `puck:menu-action` | 原生菜单转发 |

## 9. 配置与多窗口

- `config.toml` 区段：
  - `app_settings`
  - `session_privileges`
  - `shell_layout`
  - `workspaces`
- 新增区段必须同步 Rust whitelist 与 `PUCK_CONFIG_KEYS`。
- `main` / `settings` / `connections` 共用一个前端 bundle，通过 `?window=` 区分。
- 运行态 session、编辑器标签、Graph 分页与 forwards 不持久化。

## 10. 安全边界

- 密码 / 私钥口令只进系统钥匙串；普通配置与日志不落明文。
- Host Key 未知时必须用户确认。
- 远端 Git 命令所有参数 shell quote，无前端拼接注入面。
- 端口转发默认拒绝非 loopback bind。
- 删除本地文件时拒绝文件系统根。
- Monaco 不加载语言 service worker，不提供跨文件语义数据。
