# Puck 第三轮代码审查：前两轮遗漏的问题

> 文档版本：1.0
> 基准版本：`0.1.0-alpha.1`
> 生成日期：2026-07-01
> 审查范围：全仓库，重点覆盖运行期正确性、网络韧性、发布流水线、跨平台、前端健壮性
> 关联文档：[problem.1.md](problem.1.md)、[problem.2.md](problem.2.md)、[路线图、风险与验收](05-roadmap-risks-and-acceptance.md)

## 0. 本轮定位

`problem.1.md` 与 `problem.2.md` 已经覆盖了工程化收尾类问题（测试缺失、`hosts_layout` 持久化、CSP/capability、协议占位、错误 UX 统一、Clippy warnings、Monaco 拆包、SFTP 传输阻塞、原子写、终端 tab 关闭泄漏等）。两份文档在这些方向上高度重叠，但都**停留在静态结构与工程化层面**，几乎没有深入到：

- **运行期正确性**：编码、时序、竞态、资源生命周期（终端之外）。
- **网络韧性**：超时、keepalive、断线检测、慢网络下的线程阻塞。
- **发布链路本身是否真的能出包**。
- **跨平台真实行为**（不止 `open_path_in_app`）。
- **前端崩溃兜底与状态数据完整性**。

本轮只记录**前两轮未提及的新问题**。凡与已有条目重叠的（如 `hosts_layout`、协议占位、CSP、错误 UX、测试缺失、终端 tab 关闭泄漏），本文不再重复，仅在第 6 节做关系说明。

---

## 1. P0：影响交付与数据完整性

### 1.1 Release 流水线缺少前端依赖安装，标签发布大概率直接失败

**位置：** `.github/workflows/release.yml:36-99`

`setup-node`（`:36-40`，仅 `cache: npm`，**不安装**）与 `tauri-apps/tauri-action`（`:70-99`）之间**没有 `npm ci` / `npm install` 步骤**。

`tauri-action` 会执行 `tauri.conf.json` 的 `beforeBuildCommand: "npm run build"`（即 `tsc && vite build`），这一步依赖 `node_modules`。`tauri-action` 本身**不会**自动安装前端依赖（官方工作流一律要求显式加一步 install）。

**影响：**

- 每次打 `v*` tag 触发的发布会在 `tsc`/`vite` 阶段因命令/依赖缺失而失败。
- 也就是说，当前项目实际上**没有一条能产出安装包的可用发布链路**。

**建议：**

1. 在 `tauri-action` 之前新增 `- run: npm ci`。
2. 打一个测试 tag（或用 `workflow_dispatch`）真实跑一次，确认能出四平台产物。
3. 该问题应在建立 PR CI（problem.1/2 已提）之前或同步修复。

> 置信度较高，但建议以一次真实 CI 运行作为最终确认。

---

### 1.2 删除全部连接后会“复活”示例连接，用户无法保存“空连接列表”

**位置：** `src/stores/connection-store.ts:36-68`（种子）、`:122-136`（`partialize` + `merge`）

```ts
partialize: (state) => ({ profiles: state.profiles.filter((p) => !p.ephemeral) }),
merge: (persisted, current) => {
  const stored = persisted as Partial<ConnectionStore> | undefined;
  if (stored?.profiles && stored.profiles.length > 0) { /* 用磁盘数据 */ }
  return current; // current === seedProfiles()：Dev Server / Staging SFTP / FTP Backup
},
```

当用户删除所有连接后，`partialize` 会持久化 `profiles: []`。下次 rehydrate 时 `merge` 判断 `length === 0`，于是返回 `current`（即 3 条硬编码示例）。而 rehydrate 会在**应用重启、跨窗口 `puck:config-changed`、以及每次打开命令面板**（`command-palette/index.tsx` 中 `void rehydrateConnections()`）时触发。

**影响：**

- “清空连接列表”这个状态无法被持久化。
- 用户删干净后，一打开命令面板，示例连接（含一条未实现的 FTP）又回来了，观感像 bug / 数据没删掉。

**建议：**

1. 用一个显式的 `initialized` / `seeded` 标记区分“首次启动”与“用户主动清空”。
2. 仅在从未初始化过时注入种子；已初始化后即使为空也尊重空数组。
3. `merge` 不应以 `length > 0` 作为“是否采用磁盘数据”的判据。

---

## 2. P1：运行期正确性与网络韧性（前两轮未覆盖）

### 2.1 PTY / SSH 输出在读边界处 UTF-8 被永久破坏（中文、emoji、绘框字符乱码）

**位置：** `src-tauri/src/terminal.rs:116-121`，同类问题见 `src-tauri/src/ssh.rs:204,269,279`

```rust
let mut buffer = [0u8; 8192];
match reader.read(&mut buffer) {
    Ok(count) => {
        let data = String::from_utf8_lossy(&buffer[..count]).into_owned(); // 半个多字节字符 -> U+FFFD
```

`read` 会在任意字节边界切断多字节 UTF-8 序列，`from_utf8_lossy` 会把结尾不完整的字节**永久**替换成 `�`。前端只收到已解码的 `String`，xterm.js 无从恢复。

**影响：** 任何跨读缓冲边界的 CJK 文本、emoji、box-drawing 输出都会乱码。SSH 的 `ChannelMsg::Data` / `ExtendedData` 处理有同样缺陷。

**建议：** 在读循环间保留“不完整尾字节”，或直接把原始字节透传给前端由 xterm.js 解码（xterm 支持写入 `Uint8Array`）。

---

### 2.2 SSH 无连接超时、无 keepalive，断网后会残留“幽灵会话”

**位置：** `src-tauri/src/ssh.rs:78-84`（全仓库 grep `keepalive|timeout|inactivity` 零命中）

```rust
let config = Arc::new(client::Config::default()); // 从不设置 keepalive_interval
let mut session = client::connect(config, (host, port), handler).await // 无 tokio::time::timeout
```

**影响：**

- 目标不可达 / 被防火墙丢弃时，`connect` 会挂在 OS 默认 TCP 超时上，UI 一直停在 `creating`，也不报错。
- 无 SSH keepalive：网络中断、笔记本休眠/唤醒造成半开连接时无法被检测，io_task 会永远阻塞在 `channel.wait()`（`ssh.rs:266`），既不发 `terminal:exit`，UI 也一直显示 `connected`，任务与连接句柄泄漏。

**建议：** 为 `connect` 加 `tokio::time::timeout`；设置 `Config::keepalive_interval` / `keepalive_max`；断线转为 `disconnected` / `reconnecting` 状态。

---

### 2.3 SFTP 在握手完成前就上报 `connected`，握手失败会留下无法复用的死会话

**位置：** `src-tauri/src/sftp.rs:77-96`（握手在 task 内）、`:172-198`（先注册再报 connected）

```rust
let io_task = tokio::spawn(async move {
    let sftp = match SftpSession::new(stream).await { // 握手在 task 内部才执行
        Ok(session) => session,
        Err(error) => { /* emit failed; return */ }
    };
    ...
});
SessionManager::global().insert_sftp(request.session_id.clone(), SftpSessionEntry { .. })?; // 已注册
emit_session_status(&app, /* status: "connected" */);                                        // 已报 connected
```

`insert_sftp` 与 `connected` 事件在 `SftpSession::new` 完成**之前**同步触发。若 SFTP 子系统握手失败，前端已被告知 `connected`，registry 里却留着指向已死 task 的 entry。后续命令返回 `sftp response channel closed`，而用同一 `session_id` 重连又会被 `insert_sftp` 的 `contains_key` 判定为 `sftp session already exists`（`session.rs`）而**永久拒绝**。SSH 路径是先 await 好 pty/shell 再报 connected，两者不一致，进一步佐证这是 bug。

**建议：** 把握手移到 spawn 之前 await 成功后，再 `insert_sftp` + 报 `connected`；失败时清理 registry。

---

### 2.4 同步 Tauri command 里 `block_on` 阻塞派发线程，远程资源统计每次至少卡 1 秒

**位置：** `src-tauri/src/system_monitor.rs:115,152-153`；`src-tauri/src/sftp.rs:412,430,440,454,499,517`

```rust
const REMOTE_STATS_COMMAND: &str = r#"sh -c '... sleep 1; ...'"#; // 远程内置 sleep 1
#[tauri::command]
pub fn get_remote_system_stats(session_id: String) -> Result<SystemStats, String> {
    block_on(get_remote_system_stats_async(session_id)) // 在同步 command 线程里阻塞整轮往返
}
```

这些是**同步** command，`block_on` 会阻塞 Tauri 命令派发（主）线程整整一次网络往返。`get_remote_system_stats` 还内嵌远程 `sleep 1`，每次轮询都卡 ≥1s。叠加 2.2 无超时，若对端不发 `Eof`/`ExitStatus`，`exec_remote_command` 的 `while channel.wait()`（`ssh.rs:195`）可能永久冻结该线程。

**建议：** 改为异步 command（`async fn`）；移除远程 `sleep 1`，改用单次采样或前端做差值；配合 2.2 的超时。

---

### 2.5 前端无 React ErrorBoundary，任一渲染期异常直接白屏

**位置：** `src/main.tsx:9-16`、`src/layout/providers/app-providers.tsx`、`src/App.tsx`（全仓库无 `ErrorBoundary`/`componentDidCatch`/`Suspense` fallback）

任何渲染期抛错都会卸载整棵 React 树，只剩空白窗口，且无恢复途径。这不是纯理论：多处直接消费未经校验的 IPC 数据（`invoke<T>` 断言）和数组下标访问（如 `stats.loadAverage[0]`、`entries.map`）。此外 `main.tsx:16` 的 `void bootstrap()` 吞掉了 `bootstrapPersistStores()` 的 rejection——若水合抛错，React 根本不渲染，用户只看到白屏。

**建议：** 顶层加 ErrorBoundary（含错误上报/复位按钮）；对 IPC 响应做运行时校验（见 2.6）；`bootstrap()` 补 `.catch`。

---

### 2.6 SSH 终端面板：`await` 之后无 `disposed` 兜底，泄漏监听器并在卸载后发起连接

**位置：** `src/page/terminal/ssh-terminal-pane.tsx:181-266`（注册）、`:275-285`（cleanup）

```ts
void (async () => {
  unlistenData = await onTerminalData(...);
  unlistenExit = await onTerminalExit(...);
  unlistenStatus = await onSessionStatus(...);
  fitAddon.fit();
  connect(...); // 没有 disposed 守卫
})();
```

与 `terminal-pane.tsx`（其在 await 后有 `if (disposed) { unlistenDataFn(); ...; return; }` 守卫）不同，SSH 面板在三个 `await` 之后**没有** `disposed` 兜底。若 cleanup 在 `await` 完成前先跑，cleanup 里的 `unlistenData?.()` 等此刻都还是 `undefined`（空操作），随后监听器仍会被注册 → 永久泄漏，且 `connect()` 会为已卸载的面板发起 `openSshTerminal`。因 `<React.StrictMode>` 的 mount→unmount→remount，开发环境**每次**挂载 SSH 面板都会触发（双连接 + 泄漏一组监听器）。

> 说明：这与 problem.2 §1.1 记录的 `terminal-pane.tsx` 的 `disposed` 逻辑 bug **不是同一处**——那处是分支恒不执行，这里是 SSH 面板整体缺兜底。

**建议：** 三个 await 之后统一判断 `if (disposed) { unlistenData?.(); ...; return; }`；`connect()` 前也校验 `disposed`。

---

## 3. P2：资源、韧性与工程化补强

### 3.1 io_task 的 JoinHandle 从不 `abort`，卡死任务永远泄漏

**位置：** `session.rs:85,103`、`close_terminal`（`:257-273`）、`close_sftp`（`:314-319`）

关闭只靠向任务发 `SshCommand::Shutdown` 等协作式信号，随后 JoinHandle 被丢弃（detach），从不 `.abort()`。若任务正卡在无超时的 `channel.wait()` / `.await` 上（见 2.2），它永远不会退出，任务与连接句柄泄漏。全仓库无任何 `.abort()`/`.join()`。

**建议：** 关闭路径保留协作式信号，同时对 JoinHandle 加超时 `abort` 兜底。

### 3.2 SSH exec handle registry 无 owner/generation，重连竞态会误删新句柄

**位置：** `ssh.rs:151-176`（registry）、`:246`（store）、`:313`（remove）、`:404-405`（reconnect）

exec-handle registry 仅以 `session_id` 为 key。重连时新 task 存入句柄后，旧 task 的 shutdown 清理仍会执行 `remove_ssh_exec_handle(session_id)`，可能把**新**会话的句柄删掉，静默破坏该会话的 `get_remote_system_stats` / `exec_remote_command`。

**建议：** 句柄带 generation/token，remove 时校验归属。

### 3.3 keyring 失败被吞、被误报、删除失败被忽略

**位置：** `ssh.rs:107-115`（password）、`ssh.rs:127-130`（passphrase）、`credential.rs:35-41`（delete）

- password 路径用 `.ok().flatten()` 丢弃真实错误，Keychain 被拒/锁定会被误报成 `missing credential: password`。
- passphrase 路径用 `.or(...)`（eager），即使用户已显式提供 passphrase 也会去读 keyring，其 `?` 会因 keyring 错误直接中断认证；应改 `.or_else(...)`。
- `delete_connection_credentials` 对每个字段 `let _ = delete_credential(...)`，删除失败被忽略，连接删掉后密钥可能仍留在系统钥匙串。

### 3.4 阻塞文件读取 + 密钥 KDF 跑在异步 runtime 上

**位置：** `ssh.rs:126,131`（在 async `authenticate` 内）

`std::fs::read_to_string(path)` 阻塞执行器；`read_credential` 可能在 macOS Keychain 上阻塞（甚至弹窗）；加密私钥的 `decode_secret_key` 会在异步 worker 上跑 KDF 占 CPU。应包进 `spawn_blocking`。

### 3.5 全仓库无结构化日志，`let _ =` 大面积吞错

**位置：** 全 crate（grep `tracing|log|eprintln|println` 零命中）。例：`config.rs:150` `let _ = save_config(...)`、`known_hosts.rs:73`、`themes.rs:64,70`，以及所有 `let _ = app.emit(...)`。

配置未落盘、host key 未写盘、事件丢失等在现场完全不可见。**建议：** 引入 `tracing`，至少对持久化/emit 失败记 warn。

### 3.6 无任何自动更新机制

**位置：** `Cargo.toml` / `package.json` / `tauri.conf.json` / `capabilities`

无 `tauri-plugin-updater`、无 updater 端点、无 `updater:default` capability。用户只能手动重新下载。因产物也未签名，日后加 updater 必须同时引入签名密钥。（problem.1 §5 只提到“updater 签名”，实际上 updater 本身并不存在。）

### 3.7 依赖冗余与版本错配

**位置：** `src-tauri/Cargo.toml`

- 6 个未使用依赖（源码零引用）：`hex`、`data-encoding`、`sha2`、`async-trait`、`ssh-key`、`uuid`。
- `russh-keys 0.49.2` 与 `russh 0.61.2` 错配：真实密钥操作走 `russh::keys::*`，旧 crate 只在 `error.rs` 一处 `From` 用到，却在 `Cargo.lock` 里拉入重复传递依赖（`russh-cryptovec` 0.48 与 0.61、`russh-util` 0.48 与 0.52 等）。统一到 `russh::keys` 可移除旧副本。

### 3.8 tsconfig 缺关键安全 flag

**位置：** `tsconfig.json:22-25`

`strict` + `noUnusedLocals/Parameters` 已开，但 **关闭**：`noUncheckedIndexedAccess`（最关键——数组/记录下标被当作永远有定义，掩盖 `undefined` bug，而代码里有 `breadcrumbs[0]`、`match[2]` 等）、`exactOptionalPropertyTypes`、`noImplicitReturns`、`noImplicitOverride`、`noPropertyAccessFromIndexSignature`。

### 3.9 vite.config 缺 `build` 配置，Linux 旧 webkit2gtk 可能运行期报错

**位置：** `vite.config.ts:10-38`（只有 `plugins`/`server`/`resolve`）

缺 Tauri 推荐的 `build.target`（按 OS 设 esbuild target）、`minify`、`sourcemap`、`chunkSizeWarningLimit`。没有 `build.target` 时，为 Vite 默认 target 产出的现代 JS 可能在 Linux 较老 `webkit2gtk` 上运行期失败。（与 problem.2 §2.6 的 Monaco 懒加载是不同问题。）

### 3.10 跨平台正确性（超出 `open_path_in_app`）

- **配置目录在所有平台硬编码 `~/.config/puck`**（`config.rs:80-86`，注释亦如此写），Windows 应用 `%APPDATA%`、macOS 应用 `~/Library/Application Support`，应改用 `dirs::config_dir()`。`known_hosts.rs`、`themes.rs` 复用同一路径。
- **本地文件浏览器假定 POSIX `/` 分隔符**：后端 `workspace.rs:79` 用 `to_string_lossy` 返回原生路径（Windows 为反斜杠），前端 `local-file-explorer.tsx` 的面包屑 `cwd.split("/")`（`:56`）与上级导航正则 `/\/[^/]+$/`（`:161`）在 Windows 上会失效。（SFTP 远程路径恒为 `/`，不受影响。）

### 3.11 前端持久化与监听的健壮性

- **持久化写入 fire-and-forget 无兜底**：`puck-config-storage.ts:128,140` 的 `void invoke("set_puck_config_section", ...)` 写失败既丢设置又是未捕获 rejection——这是所有 Zustand store 的唯一落盘路径。
- **同一 `config.toml` 的并发无序写**：所有分区经同一 `setItem` 无队列地 `invoke`，同分区快速连写可能乱序（最后写入非预期值），跨分区并发写完全依赖后端串行化。
- **多处 async `listen()` cleanup 竞态泄漏监听器**：`file-manager/index.tsx:136-161`、`session-status-listener.tsx:19-46`、`window-controls.tsx:81-92`、`sftp-explorer-session.ts:39-53`、`connection-bridge.ts:56-66`。
- **随 i18n `t` 身份变化重订阅/重拉取**：`session-status-listener.tsx:48`（deps `[t]` → 切语言重订阅全局监听）、`remote-file-explorer.tsx:84-117`、`git-panel.tsx:71-87`（切语言触发一次完整 SFTP 往返）。
- **`useAppVersion`**（`use-app-version.ts:11-13`）无 `.catch`、无卸载守卫。

### 3.12 大目录列表无虚拟化

**位置：** `remote-file-table.tsx:68`、`remote-file-explorer.tsx:204`、`local-file-explorer.tsx:170`（依赖里无 `react-window`/`virtua`/`@tanstack/virtual`）。上千条目录会渲染上千 DOM 节点，导航/刷新卡顿。

### 3.13 命令面板不是可访问对话框

**位置：** `command-palette/index.tsx:146-228`

自定义 `fixed inset-0` 遮罩，无 `role="dialog"`/`aria-modal`、无焦点陷阱（Tab 会跑到遮罩后面）、关闭不恢复焦点；结果列表无 `role="listbox"/option`/`aria-activedescendant`。此外 `:154,199,209,222,228` 用了硬编码十六进制色（`bg-[#1a1a1a]` 等），在浅色/自定义主题下会错。

### 3.14 IPC 响应仅类型断言、无运行期校验

**位置：** `tauri-system.ts:21,25`、`tauri-ssh.ts`/`tauri-sftp.ts`/`tauri-terminal.ts` 的 `invoke<T>`/`listen<T>`、`puck-error.ts:25` 的 `JSON.parse(error) as PuckErrorPayload`。后端形状不符会在渲染期变成 undefined 访问，叠加 2.5 无 ErrorBoundary → 白屏。`parsePuckError` 里 `if (parsed.code && parsed.message)` 才是应推广的安全范式。

---

## 4. P3：细节与规范

| # | 问题 | 位置 |
| --- | --- | --- |
| 1 | Release actions 全部绑可变 tag，`tauri-action@v0` 为过时主版本；未 SHA pin | `release.yml:34,37,43,48,71` |
| 2 | alpha 版本却 `prerelease: false` | `release.yml:98` |
| 3 | 产品名不一致：`Puck`（productName）/ `puck`（窗口 title）/ `Puck Terminal`（`common.app.name`） | `tauri.conf.json:3,17`、`about-section.tsx:24` |
| 4 | `package.json` 缺 `license`/`repository`/`description`/`author`/`engines` | `package.json:1-11` |
| 5 | 原生菜单仅 macOS，Win/Linux 缺无快捷键入口的菜单动作（新建连接、管理连接、关于） | `lib.rs:97-105` |
| 6 | `known_hosts.rs:164,177` 错误路径 `serde_json::to_string(...).unwrap()`（应像 `error.rs:131` 用 `unwrap_or`） | `known_hosts.rs` |
| 7 | git porcelain 用字节切片 `line[3..]`，非字符边界会 panic | `workspace.rs:155` |
| 8 | Monaco 仅 `editor?.dispose()`，未显式 `getModel()?.dispose()` | `monaco-editor-pane.tsx:60` |
| 9 | `.gitignore` 无 `.env`/`*.key`/`*.pem`/`*.p12`/updater 私钥等 secret 模式（`*.local` 覆盖不到） | `.gitignore` |

---

## 5. 已复核确认“不是问题”的项

为避免后续重复排查，以下经本轮验证确认无问题：

- **锁跨 `.await`**：`session.rs`/`config.rs`/`known_hosts.rs`/`system_monitor.rs`/`ssh.rs` 中每个 `std::sync::Mutex` guard 都限定在同步作用域，无死锁/阻塞 runtime 隐患。
- **i18n key 覆盖**：`en-US` 与 `zh-CN` 9 个命名空间 key 完全一致，无缺漏（`errors.json` 偏薄已在前两轮记录）。
- **水合闪烁**：所有持久化 store 用 `skipHydration: true` 并在 `bootstrap-persist-stores.ts` 中 await 后再 render，无默认值闪烁。
- **`dist/` 未入库**：已被 `.gitignore` 忽略且未跟踪，仅为本地产物。
- **xterm/定时器清理**：xterm `dispose()`、资源轮询 `clearInterval`、`setTimeout` 清理基本正确。
- **无 `any`/`@ts-ignore`/非空 `!`**：应用代码中未发现。

---

## 6. 与前两轮文档的关系

| 主题 | problem.1 / problem.2 已覆盖 | 本轮新增/深化 |
| --- | --- | --- |
| 资源生命周期 | 本地终端 tab 关闭泄漏（p2 §1.1） | SFTP 报 connected 时序（2.3）、io_task 从不 abort（3.1）、SSH 面板监听器泄漏（2.6） |
| 网络韧性 | 远程轮询叠加请求（p2 §2.7） | 无超时/keepalive（2.2）、同步 command block_on 卡线程（2.4） |
| 编码正确性 | — | PTY/SSH UTF-8 边界破坏（2.1） |
| 发布链路 | 签名被注释（p1 §5.2） | 缺 npm install 致发布失败（1.1）、无 updater（3.6）、action 未 pin（P3） |
| 跨平台 | `open_path_in_app` 仅 macOS（p1 §4） | 配置目录硬编码（3.10）、本地路径分隔符（3.10）、无 Win/Linux 菜单（P3） |
| 前端健壮性 | 错误 UX 不统一（p1 §6 / p2 §3.2） | 无 ErrorBoundary（2.5）、IPC 无运行期校验（3.14）、种子连接复活（1.2） |
| 依赖/构建 | Monaco 拆包（p2 §2.6） | 冗余/错配依赖（3.7）、tsconfig flag（3.8）、vite build target（3.9） |

---

## 7. 建议修复顺序

| 优先级 | 事项 | 原因 |
| --- | --- | --- |
| P0 | 修复 Release 缺 `npm ci` | 当前无可用发布链路 |
| P0 | 连接种子复活（1.2） | 用户可感知的数据完整性问题 |
| P1 | PTY/SSH UTF-8 边界（2.1） | 中文/emoji 直接乱码 |
| P1 | SSH 超时/keepalive（2.2）+ 同步 command 异步化（2.4） | 卡 UI、幽灵会话 |
| P1 | SFTP connected 时序（2.3） | 死会话且无法重连 |
| P1 | 顶层 ErrorBoundary（2.5）+ SSH 面板 disposed 兜底（2.6） | 白屏 + 监听器/连接泄漏 |
| P2 | io_task abort（3.1）、exec handle 归属（3.2）、keyring 错误处理（3.3）、spawn_blocking（3.4）、tracing 日志（3.5） | 稳定性与可诊断性 |
| P2 | 跨平台配置目录/路径（3.10）、tsconfig/vite（3.8/3.9）、依赖清理（3.7） | 跨平台正确性与工程化 |
| P2 | 前端持久化兜底/监听竞态/虚拟化/可访问性（3.11–3.14） | 韧性与体验 |
| P3 | action pin、产品名、metadata、菜单、panic 兜底（第 4 节） | 规范化 |

---

## 8. 简短结论

前两轮把“看得见的工程化欠账”盘清了；本轮补上的是**看不见的运行期正确性**：发布链路实际上跑不通、断网/慢网下会残留幽灵会话、终端中文乱码、删连接又复活、以及缺少崩溃兜底。建议先修两条 P0（发布、种子复活）解除“不能发、数据怪”的直接观感问题，再推进 P1 的编码/网络/时序正确性，随后统一收口资源生命周期与跨平台细节。

---

## 9. 修订记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| 1.0 | 2026-07-01 | 初版：聚焦前两轮遗漏的运行期正确性、网络韧性、发布链路与跨平台问题 |
