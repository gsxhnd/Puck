# Puck 文档：连接模型与协议

## 1. Profile

`ConnectionProfile` 只保留：

```text
local | ssh | sftp
```

- `ssh`：远程终端 / 远程 Workspace / SFTP 能力。
- `sftp`：独立文件管理器兼容入口。
- `local`：本地 Profile 不持久化到 `connections.json`。

历史配置迁移：

- rehydrate 时过滤 `local`。
- 过滤 `ftp` / `ftps` / `rdp` / `vnc`。
- 保留的 SSH / SFTP Profile 不需要版本迁移。

Profile 字段：

- name、host、port、username；
- authMethod：`password | privateKey | none`；
- privateKeyPath；
- askPasswordEachTime；
- defaultDirectory；
- terminalThemeId；
- createdAt / updatedAt。

明文密码和 passphrase 不进入 Profile。

## 2. Workspace 与 Session

Workspace：

```text
Workspace
├── id: local:<root> | remote:<profileId>:<root>
├── source: local | remote
├── rootPath
└── profileId?（remote only）
```

Session：

```text
Session
├── id
├── kind: terminal | files
├── protocol
├── workspaceId
├── cwd
└── status
```

规则：

- Workspace root 固定，不随终端 `cd` 改变。
- 终端 `cd` 只影响该终端标签和其 OSC 7 显示。
- 同一 Workspace 可以打开多个终端。
- 切换 Workspace 时底部终端列表按 `workspaceId` 过滤；运行中的旧终端保留租约。
- 关闭最后一个终端不会退出应用。

## 3. 共享 SSH 生命周期

### 建立顺序

1. `RemoteWorkspaceConnection` 解析凭据。
2. `ensure_ssh_connection` 获取 `workspace:<workspaceId>` 基础租约。
3. 后端 `acquire_shared_ssh()`：
   - profile endpoint 匹配且 handle 未关闭 → 复用；
   - 否则 single-flight 认证并创建新 transport。
4. Files / Git / Terminal / Ports 各自获取独立 lease。

### 释放顺序

1. Workspace 切换或关闭：
   - 停止该 profile 的全部 forwards；
   - release workspace lease。
2. 终端关闭：
   - close terminal entry；
   - clear exec mapping；
   - release terminal lease。
3. SFTP 关闭：
   - close command channel；
   - release SFTP lease。
4. `release_shared_ssh()` 在 owner set 清空时才调用 russh disconnect。

### Open generation

- 每次 `open_ssh_terminal` / `open_file_connection` 生成递增 generation。
- close / reconnect / cleanup 递增同一 sessionId 的 generation。
- 异步握手完成后会再次检查 generation：
  - stale attempt 释放自己的 lease 并直接返回；
  - 不会注册 SessionManager；
  - 不会触发 connected 状态。
- 该机制覆盖 React StrictMode、快速关闭、重连和迟到的网络响应。

## 4. 凭据

### Password

- `askPasswordEachTime=true`：每次连接弹窗，凭据只存在当前尝试。
- 否则读取系统钥匙串；缺失时弹窗并保存。

### Private key

- 私钥路径来自 Profile。
- passphrase：
  - `askPasswordEachTime=true`：每次询问；
  - 否则读取钥匙串；缺失时弹窗并保存。

### 传递规则

- 前端解析到的 secrets 只在当前连接尝试中传递给 Rust。
- Rust 不持久化 secrets。
- 共享连接建立后，后续 terminal / SFTP / Git / forward 不需要再次携带 secrets。

## 5. Host Key

- `SshClientHandler::check_server_key` 检查 `known_hosts.json`。
- 未信任时返回结构化 `HostKeyUnknown`。
- 前端：
  - 终端使用 `SshTerminalPane` + `HostKeyDialog`；
  - Workspace 使用 `RemoteWorkspaceConnection` + `HostKeyDialog`。
- 用户确认后写入 known hosts 并重试。
- 拒绝后状态为 failed，不写入信任记录。

## 6. SFTP

### Workspace explorer

- 逻辑 session id：`workspace:<workspaceId>__explorer`。
- 负责目录浏览、文件操作、Git worktree Diff 读取。
- 关闭 Workspace 时随基础租约清理。

### Editor session

- 逻辑 session id：`editor:<connectionId>`。
- 由 editor document registry 引用计数管理。
- 关闭最后一个远程文档时关闭 SFTP session。
- 关闭 explorer 或 terminal 不影响正在编辑的远程文档。

### 并发

- `ensureSftpSession()` 用同 sessionId in-flight Promise 去重。
- 后端 `insert_sftp` 拒绝重复 sessionId。
- SFTP open generation 防止迟到连接注册旧 session。

## 7. Remote Git

- 前端传入：
  - `connectionId`
  - workspace root path
  - command-specific参数。
- Rust 组装：
  - `GIT_TERMINAL_PROMPT=0`
  - `git -C <quoted workspace>`
  - quoted arguments。
- 不使用 shell 字符串拼接用户输入。
- `~` / `~/...` 映射为 quoted `$HOME`，远端无 Git repo、路径无权限或 git 不存在时返回结构化错误。
- 网络认证 / upstream / 网络错误返回 `GitNetworkResult`，前端提供终端降级。

## 8. Local port forwarding

请求：

```text
forwardId
connectionId
localHost        // 127.0.0.1 / ::1
localPort        // 0–65535，0 自动分配
remoteHost       // 从 SSH server 视角解析
remotePort       // 1–65535
```

安全规则：

- 非 loopback bind 直接拒绝。
- 默认 UI 固定 `127.0.0.1`。
- 单个远端 target 拒绝只关闭对应本地 socket，不影响 listener 或 SSH。
- SSH 断开时停止整个 forward。
- stop / Workspace 切换会等待 supervisor 退出，避免立即重绑同端口遇到 `AddrInUse`。

事件：

```text
forward:status
├── running
├── stopped
└── failed + error
```

## 9. 明确协议边界

- 不提供 FTP / FTPS。
- 不提供 RDP / VNC。
- 不提供 SSH remote forward（`-R`）。
- 不提供 dynamic / SOCKS forward（`-D`）。
- 不提供 SSH Agent 和 ProxyJump。
- 不提供目录同步。
