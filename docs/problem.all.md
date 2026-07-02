# Puck 代码审查：问题与改进清单（三篇整合）

> 文档版本：1.0
> 基准版本：`0.1.0-alpha.1`
> 审查范围：全仓库（前端 `src/`、后端 `src-tauri/`、Tauri 配置、CI、构建与文档）
> 关联文档：[路线图、风险与验收](05-roadmap-risks-and-acceptance.md)、[架构与技术栈](02-architecture-and-stack.md)
> 整合来源：[problem.1.md](problem.1.md)、[problem.2.md](problem.2.md)、[problem.3.md](problem.3.md)

本文档整合了三轮代码审查的发现，按优先级（P0/P1/P2/P3）组织，合并了重叠内容，涵盖工程化收尾、运行期正确性、网络韧性、跨平台行为与前端健壮性等全部维度。

---

## 1. 总体评价

Puck 是一个架构清晰、文档诚实的 alpha 桌面应用（Tauri v2 + React + Rust，约 23k LOC）。前后端职责划分合理，安全边界（钥匙串、host key 校验）有认真设计。

| 维度 | 评价 | 说明 |
| --- | --- | --- |
| 架构设计 | 强 | FE/BE 分层清晰，IPC 封装、Zustand 持久化适配器设计合理 |
| 代码质量 | 良好 | TypeScript `strict`、Rust 结构化错误、模块边界清楚 |
| 文档 | 强于同类 alpha | `docs/` 与 README 对未实现功能有明确说明 |
| 测试与 CI | 明显短板 | 零自动化测试，仅 tag 触发的 release 流水线 |
| 产品完整度 | alpha 合理 | 核心 SSH/SFTP/终端可用，若干协议仍为占位 |

**结论：** 当前最大短板不是架构，而是缺少自动化测试与 PR 级 CI；其次是若干已知 bug（`hosts_layout` 持久化、终端关闭泄漏、UTF-8 乱码等）和运行期正确性问题。

---

## 2. P0：需要优先修复的问题

### 2.1 Release 流水线缺少 `npm ci`，发布链路不可用

**位置：** `.github/workflows/release.yml:36-99`

`setup-node`（`:36-40`，仅 `cache: npm`，不安装）与 `tauri-action`（`:70-99`）之间没有 `npm ci` / `npm install` 步骤。`tauri-action` 会执行 `beforeBuildCommand: "npm run build"`，这依赖 `node_modules`。`tauri-action` 本身不会自动安装前端依赖。

**影响：** 每次打 `v*` tag 触发的发布会在构建阶段失败。当前项目实际上没有一条能产出安装包的可用发布链路。

**建议：**

1. 在 `tauri-action` 之前新增 `- run: npm ci`
2. 用 `workflow_dispatch` 真实跑一次，确认能出四平台产物

---

### 2.2 删除全部连接后会"复活"示例连接 — **已修复**

**状态：** 已修复（2026-07-02）

**原位置：** `src/stores/connection-store.ts`（种子 + `merge` 逻辑）

**原问题：** 删除全部连接后 `partialize` 持久化 `profiles: []`，rehydrate 时 `merge` 以 `length > 0` 为判据，回退到硬编码示例连接。

**修复：**

1. 移除全部示例连接种子，初始 `profiles` 为 `[]`
2. `merge` 改为 `stored?.profiles !== undefined` 即采用磁盘数据（含空数组）
3. 连接配置迁至独立文件 `~/.config/puck/connections.json`（见 `src-tauri/src/connections.rs`、`src/lib/connection-persist-storage.ts`），跨窗口同步事件为 `puck:connections-changed`

---

### 2.3 `hosts_layout` 持久化前后端契约不一致

**位置：** `src/lib/puck-config-storage.ts`、`src/stores/hosts-layout-store.ts`、`src-tauri/src/config.rs`

前端定义并使用 `hosts_layout`，但 Rust 配置存储的 `PuckConfigFile`、`UI_SECTIONS` 和 `section_value` / `set_section_value` 未接纳该区段。写入时缓存内看似成功，落盘时被静默忽略。

**影响：** 应用重启后主机分组布局丢失。

**建议：**

1. Rust 增加 `SECTION_HOSTS_LAYOUT` 常量
2. `PuckConfigFile` 增加 `hosts_layout: Option<Value>`
3. 将 `hosts_layout` 加入 `UI_SECTIONS` 及读写 match 分支
4. 前端 `PUCK_CONFIG_KEYS` 确保一致
5. 对未知 section 返回错误或记录 warn，避免类似静默失败
6. 修复后同步更新 README 与风险文档

---

### 2.4 本地终端关闭可能泄漏后端 PTY / 子进程

**位置：** `src/page/terminal/terminal-pane.tsx`、`src-tauri/src/terminal.rs`、`src-tauri/src/session.rs`

`TerminalPane` 的 cleanup 中先执行 `disposed = true;`，随后又判断 `if (!disposed) { void closeBackendSession(sessionId); }`——该分支永远不会执行。用户关闭本地终端 tab 时，前端卸载 xterm，但后端 `SessionManager` 中的 PTY、writer、child 可能不会被显式关闭。

**影响：** 本地 shell 进程残留，Rust 侧 session registry 可能出现幽灵会话，长时间使用可能积累资源泄漏。

**建议：**

1. cleanup 中用单独变量区分"组件卸载"与"进程已退出事件"
2. 用户主动关闭 tab 时始终调用 `close_session`
3. 后端读线程自然退出时也应清理 `SessionManager` 中对应 entry
4. 手动验证：打开本地终端、关闭 tab、检查子进程是否退出

---

### 2.5 质量门禁不足：无 PR CI、无自动化测试、Clippy 严格模式失败

**现状：**

- `package.json` 无 `test`、`lint`、`typecheck` 脚本
- 仓库零自动化测试（无 `*.test.ts`、无 Rust `#[test]`）
- CI 仅有 release 流水线，无 PR / push 构建验证
- `cargo clippy --all-targets --all-features --locked -- -D warnings` 失败（10 个 warnings：unused imports、dead code、collapsible if、redundant async block、wrong self convention 等）

**影响：** 配置迁移回归、known hosts 信任策略、hosts/sidebar 分组逻辑等核心功能无回归保护。编译错误可能直接进入主分支。

**建议：**

**P0 — 立即：**

1. 新增 PR CI workflow：`npm run build` + `cd src-tauri && cargo check`
2. `package.json` 增加 `typecheck`（`tsc --noEmit`）、`lint`、`test` 脚本

**P1 — 短期：**

1. 清理所有 Clippy warnings，将 `cargo clippy -D warnings` 加入 CI
2. **Rust 单元测试**：`config` 迁移、`known_hosts` 信任逻辑、`workspace` 路径解析、`error` 序列化
3. **TypeScript 单元测试（Vitest）**：`hosts-groups.ts` / `sidebar-groups.ts` 分组、`puck-error.ts` 解析、连接表单校验

**P2 — 中期：** Tauri IPC 集成测试、Dependabot / Renovate

---

## 3. P1：运行期正确性与网络韧性

### 3.1 PTY / SSH 输出在读边界处 UTF-8 被永久破坏（中文、emoji、绘框字符乱码）

**位置：** `src-tauri/src/terminal.rs:116-121`、`src-tauri/src/ssh.rs:204,269,279`

```rust
let data = String::from_utf8_lossy(&buffer[..count]).into_owned(); // 半个多字节字符 → U+FFFD
```

`read` 会在任意字节边界切断多字节 UTF-8 序列，`from_utf8_lossy` 把结尾不完整字节**永久**替换成 `�`，xterm.js 无从恢复。

**影响：** 任何跨读缓冲边界的 CJK 文本、emoji、box-drawing 输出都会乱码。SSH 的 `ChannelMsg::Data` / `ExtendedData` 处理有同样缺陷。

**建议：** 在读循环间保留"不完整尾字节"，或直接把原始字节透传给前端由 xterm.js 解码（xterm 支持写入 `Uint8Array`）。

---

### 3.2 SSH 无连接超时、无 keepalive，断网后残留"幽灵会话"

**位置：** `src-tauri/src/ssh.rs:78-84`（全仓库 grep `keepalive|timeout|inactivity` 零命中）

```rust
let config = Arc::new(client::Config::default()); // 从不设置 keepalive_interval
let mut session = client::connect(config, (host, port), handler).await // 无 tokio::time::timeout
```

**影响：**

- 目标不可达 / 被防火墙丢弃时，`connect` 挂在 OS 默认 TCP 超时上，UI 一直停在 `creating` 不报错
- 无 SSH keepalive：网络中断、笔记本休眠/唤醒造成半开连接时无法被检测，io_task 永远阻塞在 `channel.wait()`，既不发 `terminal:exit`，UI 也一直显示 `connected`，任务与连接句柄泄漏

**建议：** 为 `connect` 加 `tokio::time::timeout`；设置 `Config::keepalive_interval` / `keepalive_max`；断线转为 `disconnected` / `reconnecting` 状态。

---

### 3.3 SFTP 在握手完成前就上报 `connected`，握手失败留下无法复用的死会话

**位置：** `src-tauri/src/sftp.rs:77-96`、`:172-198`

`insert_sftp` 与 `connected` 事件在 `SftpSession::new` 完成**之前**同步触发。若 SFTP 子系统握手失败，前端已被告知 `connected`，registry 里却留着指向已死 task 的 entry。后续命令返回 `sftp response channel closed`，而用同一 `session_id` 重连又会被 `insert_sftp` 的 `contains_key` 永久拒绝。SSH 路径是先 await 好 pty/shell 再报 connected，两者不一致进一步佐证这是 bug。

**建议：** 把握手移到 spawn 之前，await 成功后，再 `insert_sftp` + 报 `connected`；失败时清理 registry。

---

### 3.4 同步 Tauri command 里 `block_on` 阻塞派发线程

**位置：** `src-tauri/src/system_monitor.rs:115,152-153`；`src-tauri/src/sftp.rs:412,430,440,454,499,517`

同步 command 中的 `block_on` 阻塞 Tauri 命令派发线程进行网络往返。`get_remote_system_stats` 还内嵌远程 `sleep 1`，每次轮询都卡 ≥1s。叠加无超时，若对端不发 `Eof`/`ExitStatus`，`exec_remote_command` 的 `while channel.wait()` 可能永久冻结线程。同时，远程资源监控定时器可能导致前一次请求未完成时开始下一次请求。

**建议：** 改为异步 command（`async fn`）；移除远程 `sleep 1`，改用单次采样或前端做差值；前端增加 in-flight guard，下一次 poll 在上一次完成后再调度。

---

### 3.5 SFTP 传输阻塞同一 session 的其他文件操作

**位置：** `src-tauri/src/sftp.rs`

SFTP session 使用一个 command loop 处理所有命令。`Upload` / `Download` 在 match 分支内直接 `await`。大文件传输时，同一 SFTP session 的刷新目录、删除/重命名、读写远程文件等操作排队等待，文件管理器卡住。

**建议：** 传输任务使用独立 SFTP session 或独立队列；directory/list/edit 与 transfer 分离通道；增加取消信号以支持传输取消。

---

### 3.6 SSH 终端面板：`await` 之后无 `disposed` 兜底，泄漏监听器并在卸载后发起连接

**位置：** `src/page/terminal/ssh-terminal-pane.tsx:181-285`

与 `terminal-pane.tsx`（其在 await 后有 `if (disposed)` 守卫）不同，SSH 面板在三个 `await` 之后没有 `disposed` 兜底。若 cleanup 在 `await` 完成前先跑，监听器仍会被注册 → 永久泄漏，且 `connect()` 会为已卸载的面板发起 `openSshTerminal`。开发环境因 `<React.StrictMode>` 每次挂载 SSH 面板都会触发双连接 + 泄漏。

**建议：** 三个 await 之后统一判断 `if (disposed) { unlistenData?.(); ...; return; }`；`connect()` 前也校验 `disposed`。

---

### 3.7 前端无 React ErrorBoundary，任一渲染期异常直接白屏

**位置：** `src/main.tsx:9-16`、`src/App.tsx`（全仓库无 `ErrorBoundary`）

任何渲染期抛错都会卸载整棵 React 树，只剩空白窗口，且无恢复途径。多处直接消费未经校验的 IPC 数据（`invoke<T>` 断言）和数组下标访问（如 `stats.loadAverage[0]`）。此外 `main.tsx:16` 的 `void bootstrap()` 吞掉了 `bootstrapPersistStores()` 的 rejection——若水合抛错，React 根本不渲染。

**建议：** 顶层加 ErrorBoundary（含错误上报/复位按钮）；对 IPC 响应做运行时校验；`bootstrap()` 补 `.catch`。

---

### 3.8 FTP / FTPS 在 UI 中可选，但后端未实现

**位置：** `src/types/connection.ts`、`src/page/connections/connection-profile-panel.tsx`、`src/components/connections/connection-dialog.tsx`

连接类型包含 `"ftp" | "ftps"`，连接表单允许选择 FTP/FTPS，`buildProfileSessionRequest` 也会为 FTP/FTPS 创建 files session。但 `FileManager` 只支持 `sftp` 或 `ssh`，最终进入 unsupported 状态。

**影响：** 用户会误以为 FTP/FTPS 已可用，创建配置后连接失败。

**建议：**

1. 在协议下拉中禁用 FTP/FTPS，标注"即将支持"
2. `openProfileSession` 前置拦截未实现协议
3. 后端实现前，README 和 UI 保持一致表达

---

### 3.9 连接表单逻辑重复、校验薄弱

**位置：** `src/components/connections/connection-dialog.tsx`、`src/page/connections/connection-profile-panel.tsx`

连接表单 state、`profileToForm`、`emptyForm`、`formToProfilePayload`、`persistCredentials` 在 dialog 与 page panel 中重复实现。且缺少明确校验：host/username 可为空、port 非法时静默 fallback、private key path 可为空。

**建议：**

1. 抽出 `connection-profile-form.ts`，统一表单转换、校验与凭据持久化
2. 保存前返回结构化 validation errors
3. 使用现有 UI 组件展示字段级错误
4. 对协议可用性做统一判断

---

### 3.10 配置文件写入不是原子写，解析失败会静默回退

**位置：** `src-tauri/src/config.rs`、`src-tauri/src/known_hosts.rs`

`save_config` 和 `save_known_hosts_file` 使用直接 `fs::write`。`load_config` 在 TOML 解析失败时尝试迁移旧 JSON 或回默认配置，不保留损坏文件提示。

**影响：** 断电或写入中断可能损坏配置；解析失败时用户看到设置"突然恢复默认"但不知道原因。

**建议：** 写入使用临时文件 + rename 原子替换；解析失败时备份原文件为 `config.toml.bak.<timestamp>`；前端或日志提示配置已恢复默认。

---

### 3.11 首屏 / 主 bundle 体积偏大

**位置：** `src/App.tsx`、`src/layout/editor-shell.tsx`、`src/components/editor/monaco-editor-pane.tsx`

`App.tsx` 静态引入 `EditorShell`，从而引入 Monaco 路径。产物中 Monaco 相关 chunk 很大（`editor.main-*.js` 约 3.7 MB、`ts.worker-*.js` 约 7.0 MB），编辑器窗口不是主工作台首屏能力。

**建议：** `EditorShell` 使用 `React.lazy` 或按 `window=editor` 动态 import；主窗口不要静态引入 editor-only 模块；Monaco language/worker 按需加载。

---

### 3.12 Tauri 安全默认值偏宽

**位置：** `src-tauri/tauri.conf.json`、`src-tauri/capabilities/default.json`

`tauri.conf.json` 中 `"csp": null`；capability 同时覆盖所有窗口 `["main", "settings", "connections", "editor-*"]`，并授予 `opener:default`、`dialog:default`。当前无 remote URL 短期风险可控，但后续一旦加入 markdown 预览、外链内容、插件系统或 AI 输出渲染，CSP 为空会放大攻击面。

**建议：**

1. 生产环境配置最小 CSP
2. 拆分 capabilities，各窗口分别声明需要的权限
3. 避免所有窗口默认共享 dialog/opener 能力

---

## 4. P2：资源生命周期、韧性与工程化补强

### 4.1 io_task 的 JoinHandle 从不 `abort`，卡死任务永远泄漏

**位置：** `session.rs:85,103`、`close_terminal`（`:257-273`）、`close_sftp`（`:314-319`）

关闭只靠向任务发 `SshCommand::Shutdown` 等协作式信号，随后 JoinHandle 被丢弃（detach），从不 `.abort()`。若任务正卡在无超时的 `channel.wait()` 上，它永远不会退出，任务与连接句柄泄漏。全仓库无任何 `.abort()`/`.join()`。

**建议：** 关闭路径保留协作式信号，同时对 JoinHandle 加超时 `abort` 兜底。

---

### 4.2 SSH exec handle registry 无 owner/generation，重连竞态会误删新句柄

**位置：** `ssh.rs:151-176`、`:246`、`:313`、`:404-405`

exec-handle registry 仅以 `session_id` 为 key。重连时新 task 存入句柄后，旧 task 的 shutdown 清理仍会执行 `remove_ssh_exec_handle(session_id)`，可能把新会话的句柄删掉。

**建议：** 句柄带 generation/token，remove 时校验归属。

---

### 4.3 keyring 失败被吞、被误报、删除失败被忽略

**位置：** `ssh.rs:107-130`、`credential.rs:35-41`

- password 路径用 `.ok().flatten()` 丢弃真实错误，Keychain 被拒/锁定被误报为 `missing credential: password`
- passphrase 路径用 `.or(...)`（eager），即使用户已显式提供 passphrase 也会去读 keyring，其 `?` 会因 keyring 错误直接中断认证；应改 `.or_else(...)`
- `delete_connection_credentials` 对每个字段 `let _ = delete_credential(...)`，删除失败被忽略，密钥可能残留

---

### 4.4 阻塞文件读取 + 密钥 KDF 跑在异步 runtime 上

**位置：** `ssh.rs:126,131`

`std::fs::read_to_string(path)` 阻塞执行器；`read_credential` 可能在 macOS Keychain 上阻塞；加密私钥的 `decode_secret_key` 在异步 worker 上跑 KDF 占 CPU。

**建议：** 包进 `spawn_blocking`。

---

### 4.5 全仓库无结构化日志，`let _ =` 大面积吞错

**位置：** 全 crate（`tracing|log|eprintln|println` 零命中）

例：`config.rs:150` `let _ = save_config(...)`、`known_hosts.rs:73`、`themes.rs:64,70`，以及所有 `let _ = app.emit(...)`。配置未落盘、host key 未写盘、事件丢失等在运行时完全不可见。

**建议：** 引入 `tracing`，至少对持久化/emit 失败记 warn。

---

### 4.6 IPC 错误展示不一致，i18n 错误码覆盖不足

**位置：** `src/lib/puck-error.ts`、多个 `invoke(...).catch(...)` 调用点

项目已有 `PuckError` 和 `parsePuckError`，但实际使用不统一：有些主动操作失败只 `console.error`，有些直接吞掉，有些 toast，有些写入终端。`errors.json` 覆盖偏薄（约 6 个错误码）。

**建议：** 统一用户主动操作的错误路径：`invoke 失败 → parsePuckError → errors.json 映射 → toast / inline error`。扩展 `errors.json` 覆盖配置、凭据、网络、权限、文件、Git、SFTP 等常见失败。

---

### 4.7 跨平台正确性问题

- **配置目录硬编码 `~/.config/puck`**（`config.rs:80-86`），Windows 应用 `%APPDATA%`、macOS 应用 `~/Library/Application Support`，应改用 `dirs::config_dir()`
- **本地文件浏览器假定 POSIX `/` 分隔符**：后端 `workspace.rs:79` 用 `to_string_lossy` 返回原生路径（Windows 为反斜杠），前端面包屑 `cwd.split("/")` 与上级导航正则 `/\/[^/]+$/` 在 Windows 上会失效（SFTP 远程路径恒为 `/`，不受影响）
- `open_path_in_app` 仅 macOS 实现
- 原生菜单仅 macOS，Win/Linux 缺新建连接、管理连接、关于等菜单动作

---

### 4.8 前端持久化与监听健壮性

- **持久化写入 fire-and-forget 无兜底**：`puck-config-storage.ts:128,140` 的 `void invoke("set_puck_config_section", ...)` 写失败既丢设置又是未捕获 rejection——所有 Zustand store 的唯一落盘路径
- **同一 `config.toml` 的并发无序写**：所有分区经同一 `setItem` 无队列地 `invoke`，同分区快速连写可能乱序，跨分区并发写完全依赖后端串行化
- **多处 async `listen()` cleanup 竞态泄漏监听器**：`file-manager/index.tsx`、`session-status-listener.tsx`、`window-controls.tsx`、`sftp-explorer-session.ts`、`connection-bridge.ts`
- **随 i18n `t` 身份变化重订阅/重拉取**：`session-status-listener.tsx`（deps `[t]` → 切语言重订阅全局监听）、`remote-file-explorer.tsx`、`git-panel.tsx`（切语言触发完整 SFTP 往返）

---

### 4.9 无自动更新机制

**位置：** `Cargo.toml` / `package.json` / `tauri.conf.json`

无 `tauri-plugin-updater`、无 updater 端点、无 `updater:default` capability。用户只能手动重新下载。

---

### 4.10 依赖冗余与版本错配

**位置：** `src-tauri/Cargo.toml`

- 6 个未使用依赖：`hex`、`data-encoding`、`sha2`、`async-trait`、`ssh-key`、`uuid`
- `russh-keys 0.49.2` 与 `russh 0.61.2` 错配，在 `Cargo.lock` 拉入重复传递依赖。统一到 `russh::keys` 可移除旧副本

---

### 4.11 tsconfig 与 vite 配置缺失

- **tsconfig**：`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitReturns`、`noImplicitOverride`、`noPropertyAccessFromIndexSignature` 均关闭。`noUncheckedIndexedAccess` 最关键——数组/记录下标被当作永远有定义，掩盖 `undefined` bug
- **vite**：缺 Tauri 推荐的 `build.target`（按 OS 设 esbuild target）、`minify`、`sourcemap`、`chunkSizeWarningLimit`。没有 `build.target` 时默认产出的现代 JS 可能在 Linux 较老 `webkit2gtk` 上运行期失败

---

### 4.12 大目录列表无虚拟化、命令面板不可访问

- **大目录列表**：`remote-file-table.tsx`、`remote-file-explorer.tsx`、`local-file-explorer.tsx` 依赖里无 `react-window`/`virtua`/`@tanstack/virtual`。上千条目录渲染上千 DOM 节点
- **命令面板**：自定义遮罩，无 `role="dialog"`/`aria-modal`、无焦点陷阱、关闭不恢复焦点；结果列表无 `role="listbox"/option`/`aria-activedescendant`；硬编码十六进制色在浅色/自定义主题下会错

---

### 4.13 IPC 响应仅类型断言、无运行期校验

**位置：** `tauri-system.ts`、`tauri-ssh.ts`、`tauri-sftp.ts`、`tauri-terminal.ts`、`puck-error.ts`

`invoke<T>`/`listen<T>` 及 `parsePuckError` 中的 `JSON.parse(error) as PuckErrorPayload` 仅做类型断言。后端形状不符会在渲染期变成 undefined 访问，叠加无 ErrorBoundary → 白屏。`parsePuckError` 里的 `if (parsed.code && parsed.message)` 范式应推广。

---

### 4.14 shadcn/UI 规范遗留不一致

- 连接表单使用 raw `<select>`，未使用现有 `Select` / `Combobox`
- 表单大量使用 raw `<label className="grid ...">`，未统一成 Field/FieldGroup 风格
- 文件管理器使用 `window.prompt` / `window.confirm`
- 多处使用 `space-y-*`，与当前 shadcn 规则建议的 `gap-*` 不一致

**建议：** 连接表单改用统一 Field 和 Select；prompt/confirm 改为 Dialog / AlertDialog；图标按钮补齐 tooltip / aria-label。

---

### 4.15 架构层面的若干不一致

- **持久化模式不统一**：多数 store 通过 Zustand `persist()` + `puckConfigStorage` 适配器，`shell_layout` 部分逻辑在 `app-shell.tsx` 中手动读写
- **未知配置区段静默丢弃**：`config.rs` 的 `set_section_value` 对不在白名单的 key 直接 no-op，不报错、不日志（`hosts_layout` 即为此类问题的实例）
- **全局单例降低可测试性**：`SessionManager::global()`、`runtime()` 等适合桌面运行时，但单元测试和 mock 成本较高
- **Mutex `unwrap()` 模式**：`config.rs`、`known_hosts.rs` 等处使用 `Mutex::lock().unwrap()`，mutex poison 时会 panic
- **Rust 错误类型可更类型化**：`PuckError` 手写 enum + `String` 序列化，可引入 `thiserror` 建更清晰的错误层级；`to_payload(self)` 触发 clippy

---

## 5. P3：细节与规范

| # | 问题 | 位置 |
| --- | --- | --- |
| 1 | Release actions 全部绑可变 tag，`tauri-action@v0` 为过时主版本；未 SHA pin | `release.yml` |
| 2 | alpha 版本却 `prerelease: false` | `release.yml:98` |
| 3 | 产品名不一致：`Puck`（productName）/ `puck`（窗口 title）/ `Puck Terminal`（`common.app.name`） | `tauri.conf.json`、`about-section.tsx` |
| 4 | `package.json` 缺 `license`/`repository`/`description`/`author`/`engines` | `package.json` |
| 5 | `known_hosts.rs:164,177` 错误路径 `serde_json::to_string(...).unwrap()`（应像 `error.rs:131` 用 `unwrap_or`） | `known_hosts.rs` |
| 6 | git porcelain 用字节切片 `line[3..]`，非字符边界会 panic | `workspace.rs:155` |
| 7 | Monaco 仅 `editor?.dispose()`，未显式 `getModel()?.dispose()` | `monaco-editor-pane.tsx:60` |
| 8 | `.gitignore` 无 `.env`/`*.key`/`*.pem`/`*.p12`/updater 私钥等 secret 模式 | `.gitignore` |
| 9 | 无 ESLint / Prettier 统一风格 | — |
| 10 | 无 CONTRIBUTING.md / CHANGELOG.md | — |
| 11 | 发布签名未启用，release workflow 中签名相关配置被注释 | `release.yml` |

---

## 6. 功能占位与用户体验落差汇总

以下能力在连接模型、类型或 UI 层已存在，但后端未完整实现：

| 能力 | 当前状态 | 用户风险 |
| --- | --- | --- |
| FTP / FTPS | 连接模型 + UI 预留，无 Rust 后端 | 用户可能误以为协议已可用 |
| SSH Agent | 认证类型已定义，未实现 | 选项无效或行为不符预期 |
| ProxyJump | 类型/UI 预留 | 同上 |
| 端口转发 | 未实现 | — |
| 传输取消 / 暂停 / 恢复 | SFTP 队列支持进度与重试，不支持取消 | 大文件传输体验不完整 |
| `open_path_in_app` | 仅 macOS 实现 | Windows/Linux 返回不支持错误 |
| 快捷键自定义 | 固定实现 + 只读设置说明 | 高级用户期望无法满足 |
| 目录同步、远程文件预览/编辑 | 未实现 | — |

**建议：**

1. **P0**：连接表单对 FTP/FTPS 等未实现协议做禁用或明确"尚未支持"标注
2. **P1**：传输取消；`open_path_in_app` 跨平台实现或按平台隐藏
3. **P2**：SSH Agent、ProxyJump、FTP 后端等按路线图推进

---

## 7. 建议修复顺序总览

### P0 — 立即修复

| # | 事项 | 原因 |
| --- | --- | --- |
| 1 | 修复 Release 流水线缺 `npm ci` | 当前无可用发布链路 |
| 2 | ~~修复连接种子复活~~ ✅ 已修复 | 用户可感知的数据完整性问题 |
| 3 | 修复 `hosts_layout` 持久化 | 已知用户可感知 bug，改动面小 |
| 4 | 修复本地终端关闭后端资源泄漏 | 直接影响稳定性和系统资源 |
| 5 | 新增 PR CI（`build` + `cargo check`）+ `typecheck` 脚本 | 防止编译回归进入主分支 |

### P1 — 短期（核心正确性）

| # | 事项 | 原因 |
| --- | --- | --- |
| 1 | 修复 PTY/SSH UTF-8 边界破坏 | 中文/emoji 直接乱码 |
| 2 | SSH 超时/keepalive | 卡 UI、幽灵会话 |
| 3 | 同步 command 异步化 + 移除远程 `sleep 1` | 阻塞派发线程 |
| 4 | 修复 SFTP `connected` 时序 | 死会话且无法重连 |
| 5 | SFTP 传输与文件操作解耦 | 大文件场景体验改善 |
| 6 | 顶层 ErrorBoundary | 防止渲染异常白屏 |
| 7 | SSH 面板 disposed 兜底 | 监听器/连接泄漏 |
| 8 | FTP/FTPS UI 标注未实现或禁用 | 降低用户误解 |
| 9 | 收紧 CSP 与 capability | 发布前安全基线 |
| 10 | 拆分连接表单逻辑并补校验 | 降低重复维护成本 |
| 11 | 配置文件原子写 + 损坏备份 | 防止配置损坏丢失 |
| 12 | Monaco/editor 按窗口拆包 | 降低主窗口加载负担 |
| 13 | 核心纯函数测试（Rust + TypeScript） | 回归保护 |
| 14 | 清理 Clippy warnings 并加入 CI | 建立最低质量门禁 |

### P2 — 中期（韧性与工程化）

| # | 事项 | 原因 |
| --- | --- | --- |
| 1 | io_task abort 兜底 | 卡死任务泄漏 |
| 2 | exec handle 归属校验 | 重连竞态 |
| 3 | keyring 错误处理修正 | 认证可诊断性 |
| 4 | `spawn_blocking` 隔离阻塞 I/O | 不卡异步 runtime |
| 5 | 引入 `tracing` 结构化日志 | 运行时可诊断性 |
| 6 | 统一 IPC 错误展示（toast + i18n） | 故障可诊断性 |
| 7 | 跨平台配置目录/路径修正 | Windows 可用性 |
| 8 | tsconfig/vite 配置补全 | 工程化兜底 |
| 9 | 依赖清理 | 减少重复传递依赖 |
| 10 | 前端持久化兜底/监听竞态修正 | 韧性与数据完整性 |
| 11 | 虚拟化大目录列表 | 千级目录性能 |
| 12 | 命令面板可访问性 | A11y |
| 13 | IPC 运行期校验 | 防止白屏 |
| 14 | UI 组件规范统一 | 一致性与可访问性 |
| 15 | Rust 错误类型化（`thiserror`） | 维护性 |

### P3 — 规范与发布

| # | 事项 | 原因 |
| --- | --- | --- |
| 1 | Release action SHA pin + 修订版本号语义 | 供应链安全 |
| 2 | 统一产品名 | 品牌一致性 |
| 3 | `package.json` 元数据补全 | 包规范 |
| 4 | known_hosts/workspace panic 兜底 | 健壮性 |
| 5 | `.gitignore` secret 模式 | 安全 |
| 6 | ESLint / Prettier 引入 | 代码风格 |
| 7 | CS 签名 + 自动更新 | 分发 |
| 8 | CONTRIBUTING.md / CHANGELOG.md | 协作规范 |

---

## 8. 已验证确认"不是问题"的项

以下经复核确认无问题：

- **锁跨 `.await`**：每个 `std::sync::Mutex` guard 限定在同步作用域，无死锁/阻塞 runtime 隐患
- **i18n key 覆盖**：`en-US` 与 `zh-CN` 9 个命名空间 key 完全一致
- **水合闪烁**：所有持久化 store 用 `skipHydration: true` 并在 `bootstrap-persist-stores.ts` 中 await 后再 render
- **`dist/` 未入库**：已被 `.gitignore` 忽略且未跟踪
- **xterm/定时器清理**：xterm `dispose()`、资源轮询 `clearInterval`、`setTimeout` 清理正确
- **无 `any`/`@ts-ignore`/非空 `!`**：应用代码中未发现

---

## 9. 修订记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| 1.0 | 2026-07-01 | 初版：整合 problem.1、problem.2、problem.3 |
| 1.1 | 2026-07-02 | 标记 2.2（连接种子复活）已修复 |
