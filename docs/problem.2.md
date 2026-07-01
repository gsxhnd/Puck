# Puck 第二轮代码审查：不足与改进清单

> 文档版本：1.0  
> 基准版本：`0.1.0-alpha.1`  
> 生成日期：2026-07-01  
> 审查范围：前端 `src/`、后端 `src-tauri/`、Tauri 配置、构建与文档  
> 关联文档：[problem.1.md](problem.1.md)、[路线图、风险与验收](05-roadmap-risks-and-acceptance.md)、[架构与技术栈](02-architecture-and-stack.md)

本文档记录本轮静态审查发现的主要不足。整体判断：项目功能面已经比较完整，架构也清楚；当前短板主要集中在资源生命周期、持久化契约、质量门禁、安全默认值、未实现能力的 UI 暴露，以及首屏构建体积。

---

## 1. P0：需要优先修复的问题

### 1.1 本地终端关闭可能泄漏后端 PTY / 子进程

**位置：**

- `src/page/terminal/terminal-pane.tsx`
- `src-tauri/src/terminal.rs`
- `src-tauri/src/session.rs`

**问题：**

`TerminalPane` 的 cleanup 中先执行：

```ts
disposed = true;
```

随后又判断：

```ts
if (!disposed) {
  void closeBackendSession(sessionId);
}
```

该分支永远不会执行。用户关闭本地终端 tab 时，前端会卸载 xterm，但后端 `SessionManager` 中的 PTY、writer、child 可能不会被显式关闭。

**影响：**

- 本地 shell 进程可能残留。
- Rust 侧 session registry 可能出现幽灵会话。
- 长时间使用后可能积累资源泄漏。

**建议：**

1. cleanup 中用单独变量区分“组件卸载”与“进程已退出事件”。
2. 用户主动关闭 tab 时始终调用 `close_session`。
3. 后端读线程自然退出时也应清理 `SessionManager` 中对应 entry，避免只发 `terminal:exit` 不释放 registry。
4. 增加手动验证：打开本地终端、关闭 tab、检查子进程是否退出。

---

### 1.2 `hosts_layout` 持久化前后端契约不一致

**位置：**

- `src/lib/puck-config-storage.ts`
- `src/stores/hosts-layout-store.ts`
- `src-tauri/src/config.rs`

**问题：**

前端定义并使用 `hosts_layout`：

```ts
hostsLayout: "hosts_layout"
```

但 Rust 配置存储的 `PuckConfigFile`、`UI_SECTIONS` 和 `section_value` / `set_section_value` 未接纳该区段。写入时缓存内看似成功，落盘时会被静默忽略。

**影响：**

- Hosts 主机分组、排序、自定义分组运行时可用。
- 应用重启后布局丢失。
- 文档已多处标注该已知风险，说明这是未收敛问题。

**建议：**

1. 在 Rust 增加 `SECTION_HOSTS_LAYOUT`。
2. `PuckConfigFile` 增加 `hosts_layout: Option<Value>`。
3. 将 `hosts_layout` 加入 `UI_SECTIONS`。
4. `section_value` / `set_section_value` 支持该 key。
5. 对未知 section 返回错误或记录 warn，避免类似静默失败再次发生。
6. 修复后同步更新 README 与风险文档中的已知限制。

---

### 1.3 质量门禁不足，Clippy 严格模式无法通过

**位置：**

- `package.json`
- `src-tauri/src/*.rs`

**当前验证结果：**

- `npm run build`：通过。
- `cd src-tauri && cargo check`：通过，但有 10 个 warnings。
- `cd src-tauri && cargo clippy --all-targets --all-features --locked -- -D warnings`：失败。

**Clippy 失败类型：**

- unused imports：`config.rs`、`sftp.rs`、`ssh.rs`、`terminal.rs`
- unused mut：`sftp.rs`
- dead code：`require_credential`、`KnownHostsStore::prompt_for_key`、`SessionKind::Sftp`、`io_task` 字段等
- collapsible if：`config.rs`、`shell.rs`
- redundant async block：`sftp.rs`
- wrong self convention：`PuckError::to_payload(self)`
- redundant closure：`lib.rs`

**影响：**

- 当前只能说明“能编译”，不能说明“达到可维护质量门槛”。
- 未使用字段和未构造 enum 可能暗示设计已变但代码未清理。
- 后续 CI 若直接加 `-D warnings` 会立即红。

**建议：**

1. 清理所有 unused / dead code。
2. 决定 `io_task` 是否需要保留：若保留，应在关闭时 `abort` / `await` / 使用它表达生命周期；若不需要，移除字段。
3. 将 `cargo clippy --all-targets --all-features --locked -- -D warnings` 加入 CI。
4. `package.json` 增加 `typecheck`、`lint`、`test` 脚本。

---

### 1.4 自动化测试缺失

**位置：**

- README 已说明仓库没有独立测试脚本。
- 仓库未发现 `*.test.ts`、`*.spec.ts` 或 Rust `#[test]` 测试模块。

**影响：**

- 配置迁移、known hosts、连接表单、分组拖拽等高价值逻辑没有回归保护。
- 目前依赖手动验证，越到后期越慢。

**建议优先补测：**

Rust：

- `config.rs`：section 读写、旧 JSON 迁移、未知 section 行为。
- `known_hosts.rs`：信任、替换、删除、fingerprint 匹配。
- `workspace.rs`：Git porcelain 解析、路径解析。
- `error.rs`：错误 payload 序列化。

TypeScript：

- `hosts-groups.ts` / `sidebar-groups.ts`：分组、排序、拖拽移动、去重。
- `puck-error.ts`：错误解析。
- `connection-profile-panel.tsx` 中抽出的表单 payload 函数。
- `terminal-split-store.ts` 中可抽出的布局纯函数。

---

## 2. P1：中短期应处理的问题

### 2.1 Tauri 安全默认值偏宽

**位置：**

- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json`

**问题：**

`tauri.conf.json` 中：

```json
"csp": null
```

capability 同时覆盖：

```json
"windows": ["main", "settings", "connections", "editor-*"]
```

并授予：

```json
"opener:default",
"dialog:default"
```

**影响：**

当前应用没有加载 remote URL，短期风险可控。但后续一旦加入 markdown 预览、富文本、外链内容、插件系统或 AI 输出渲染，CSP 为空会放大攻击面。

**建议：**

1. 生产环境配置最小 CSP。
2. 拆分 capabilities，例如 main、settings、connections、editor 分别声明需要的权限。
3. 避免所有窗口默认共享 dialog/opener 能力。
4. 在新增插件或远程内容能力前，把 capability 审计列为发布前检查项。

---

### 2.2 FTP / FTPS 在 UI 中可选，但后端未实现

**位置：**

- `src/types/connection.ts`
- `src/page/connections/connection-profile-panel.tsx`
- `src/components/connections/connection-dialog.tsx`
- `src/lib/open-connection-profile.ts`
- `src/page/files/file-manager/index.tsx`

**问题：**

连接类型包含：

```ts
type ConnectionProtocol = "local" | "ssh" | "sftp" | "ftp" | "ftps";
```

连接表单允许选择 FTP/FTPS，`buildProfileSessionRequest` 也会为 FTP/FTPS 创建 files session。但 `FileManager` 只支持 `sftp` 或 `ssh`，最终会进入 unsupported 状态。

**影响：**

- 用户会误以为 FTP/FTPS 已可用。
- 创建配置后连接失败，体验绕。

**建议：**

1. 在协议下拉中禁用 FTP/FTPS，标注“即将支持”。
2. 或保存可以保留，但连接按钮禁用并说明原因。
3. `openProfileSession` 前置拦截未实现协议，不创建无效 session。
4. 后端实现前，README 和 UI 保持一致表达。

---

### 2.3 连接表单逻辑重复，校验薄弱

**位置：**

- `src/components/connections/connection-dialog.tsx`
- `src/page/connections/connection-profile-panel.tsx`

**问题：**

连接表单 state、`REMOTE_PROTOCOLS`、`profileToForm`、`emptyForm`、`formToProfilePayload`、`persistCredentials` 在 dialog 与 page panel 中重复实现。

同时缺少明确校验：

- host 可为空。
- username 可为空。
- port 非法时静默 fallback。
- private key path 可为空。
- unsupported protocol 没有保存/连接层面的统一拦截。

**影响：**

- 修改字段或校验时容易修一处漏一处。
- 用户可能保存不可连接配置。

**建议：**

1. 抽出 `connection-profile-form.ts`，统一表单转换、校验与凭据持久化。
2. 保存前返回结构化 validation errors。
3. 使用现有 UI 组件展示字段级错误。
4. 对协议可用性做统一判断。

---

### 2.4 SFTP 传输会阻塞同一 session 的其他文件操作

**位置：**

- `src-tauri/src/sftp.rs`

**问题：**

SFTP session 使用一个 command loop 处理所有命令。`Upload` / `Download` 在 match 分支内直接 `await run_upload` / `await run_download`。

**影响：**

大文件传输时，同一 SFTP session 的以下操作会排队等待：

- 刷新目录
- 删除 / 重命名
- 读取 / 写入远程文件
- 新建目录

用户体验上会表现为文件管理器卡住。

**建议：**

1. 传输任务使用独立 SFTP session 或独立任务队列。
2. directory/list/edit 操作与 transfer 操作分离通道。
3. 增加取消信号，支持传输取消。
4. 前端对“正在传输导致操作排队”给出状态提示。

---

### 2.5 配置文件写入不是原子写，解析失败会静默回退

**位置：**

- `src-tauri/src/config.rs`
- `src-tauri/src/known_hosts.rs`

**问题：**

`save_config` 和 `save_known_hosts_file` 使用直接 `fs::write`。`load_config` 在 TOML 解析失败时会尝试迁移旧 JSON 或回默认配置，没有保留损坏文件提示。

**影响：**

- 断电或写入中断可能损坏配置。
- 配置解析失败时用户可能看到设置“突然恢复默认”，但不知道原因。

**建议：**

1. 写入使用临时文件 + rename 原子替换。
2. 解析失败时将原文件备份为 `config.toml.bak.<timestamp>`。
3. 前端或日志提示配置已恢复默认。
4. 为配置迁移和损坏文件场景加测试。

---

### 2.6 首屏 / 主 bundle 体积偏大

**位置：**

- `src/App.tsx`
- `src/layout/editor-shell.tsx`
- `src/components/editor/monaco-editor-pane.tsx`
- `src/lib/monaco-setup.ts`

**构建观察：**

`npm run build` 通过，但产物中 Monaco 相关 chunk 很大：

- `editor.main-*.js` 约 3.7 MB
- `ts.worker-*.js` 约 7.0 MB
- `index-*.js` 约 1.5 MB

`App.tsx` 静态引入 `EditorShell`，而 `EditorShell` 静态引入 `EditorPage`，再进入 Monaco 路径。编辑器窗口不是主工作台首屏能力，适合拆包。

**建议：**

1. `EditorShell` 使用 `React.lazy` 或按 `window=editor` 动态 import。
2. 主窗口不要静态引入 editor-only 模块。
3. Monaco language/worker 按需加载，避免不需要的语言 worker 进入常规路径。
4. 构建中增加 bundle analyze 或至少记录 chunk size budget。

---

### 2.7 远程资源监控可能叠加请求

**位置：**

- `src/components/workspace/system-resources-section.tsx`
- `src-tauri/src/system_monitor.rs`

**问题：**

远程资源监控通过定时器调用 `getRemoteSystemStats`。后端命令本身包含 `sleep 1`，如果远程网络慢或 poll interval 较短，前一次请求未完成时可能开始下一次请求。

**影响：**

- 慢网络下 SSH exec 积压。
- UI 状态可能被旧响应覆盖。

**建议：**

1. 前端增加 in-flight guard。
2. 下一次 poll 在上一次完成后再调度。
3. 对远程 polling 设置更保守默认值。

---

## 3. P2：长期维护与体验问题

### 3.1 shadcn/UI 规范存在遗留不一致

**位置示例：**

- `src/components/connections/connection-dialog.tsx`
- `src/page/connections/connection-profile-panel.tsx`
- `src/page/files/file-manager/index.tsx`
- `src/components/files/transfer-queue.tsx`

**问题：**

- 连接表单使用 raw `<select>`，未使用现有 `Select` / `Combobox`。
- 表单大量使用 raw `<label className="grid ...">`，未统一成 Field/FieldGroup 风格。
- 文件管理器使用 `window.prompt` / `window.confirm`。
- 多处使用 `space-y-*`，与当前 shadcn 规则建议的 `gap-*` 不一致。
- 部分按钮内 icon 手动设置 `className="size-*"`，与“组件内 icon 由 Button 控制尺寸”的规则不完全一致。

**影响：**

- UI 行为与样式不够统一。
- 表单可访问性与验证状态难统一。

**建议：**

1. 连接表单改用统一 Field 组件和 Select。
2. prompt/confirm 改为 Dialog / AlertDialog。
3. 图标按钮补齐 tooltip / aria-label。
4. 后续 UI 改动顺手清理 `space-y-*`。

---

### 3.2 IPC 错误展示不一致

**位置：**

- `src/lib/puck-error.ts`
- `src/layout/providers/session-status-listener.tsx`
- 多个 `invoke(...).catch(...)` 调用点

**问题：**

项目已有 `PuckError` 和 `parsePuckError`，但实际使用不完全统一。有些主动操作失败只 `console.error`，有些直接吞掉，有些 toast，有些写入终端。

**影响：**

- 用户难以判断失败原因。
- i18n 错误码覆盖不足时会暴露原始技术信息。

**建议：**

统一用户主动操作的错误路径：

```text
invoke 失败 -> parsePuckError -> errors.json 映射 -> toast / inline error
```

并扩展 `errors.json`，覆盖配置、凭据、网络、权限、文件、Git、SFTP 等常见失败。

---

### 3.3 全局单例降低可测试性

**位置：**

- `src-tauri/src/session.rs`
- `src-tauri/src/runtime.rs`
- `src-tauri/src/system_monitor.rs`

**问题：**

`SessionManager::global()`、`runtime()`、`MONITOR` 等全局单例适合桌面运行时，但单元测试和集成测试会更难隔离状态。

**建议：**

1. 保留运行时 global，但将核心逻辑拆成可注入对象。
2. 纯逻辑先不依赖 Tauri `AppHandle`。
3. 为 session manager 增加测试专用实例入口。

---

### 3.4 Rust 错误类型仍可更类型化

**位置：**

- `src-tauri/src/error.rs`

**问题：**

`PuckError` 当前是手写 enum + `String` 序列化，能工作，但模块错误边界不够细。`PuckError::to_payload(self)` 也触发 clippy 的 `wrong_self_convention`。

**建议：**

1. 引入 `thiserror`，为 config/network/auth/protocol/io 建更清晰的错误层级。
2. 将 `to_payload` 改为借用或重命名为 `into_payload`。
3. Tauri command 错误统一走一个序列化函数。

---

## 4. 验证记录

本轮执行过以下命令：

```bash
npm run build
```

结果：通过。Vite 报告存在大 chunk 警告，Monaco/editor 相关产物较大。

```bash
cd src-tauri
cargo check
```

结果：通过，但产生 10 个 warnings。

```bash
cd src-tauri
cargo clippy --all-targets --all-features --locked -- -D warnings
```

结果：失败，失败项见本文 1.3。

---

## 5. 建议修复顺序

| 优先级 | 事项 | 原因 |
| --- | --- | --- |
| P0 | 修复本地终端关闭后端资源泄漏 | 直接影响稳定性和系统资源 |
| P0 | 修复 `hosts_layout` 持久化 | 已知用户可感知 bug，改动小 |
| P0 | 清理 Clippy warnings 并加入 CI | 建立最低质量门禁 |
| P0 | 增加最小测试集 | 保护配置、分组、错误解析等核心纯逻辑 |
| P1 | FTP/FTPS UI 标注未实现或禁用 | 降低用户误解 |
| P1 | 收紧 CSP 与 capability | 发布前安全基线 |
| P1 | 拆分连接表单逻辑并补校验 | 降低重复维护成本 |
| P1 | SFTP 传输与文件操作解耦 | 大文件场景体验明显改善 |
| P1 | Monaco/editor 按窗口拆包 | 降低主窗口加载负担 |
| P2 | UI 组件规范统一 | 提升一致性与可访问性 |
| P2 | 错误体系进一步类型化 | 提升维护性和用户反馈质量 |

---

## 6. 简短结论

Puck 当前不是架构问题，而是 alpha 到可发布版本之间常见的工程化收尾问题：需要把已知 bug 收掉，把质量门禁立起来，把“未实现但能点到”的功能收口，并对资源生命周期做更严格的闭环。建议先修 P0 四项，再推进体验和安全边界。
