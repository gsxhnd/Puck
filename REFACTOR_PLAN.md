# Puck 重构计划

> 日期：2026-11-18
> 状态：已确认方向，开始分阶段执行
> 技术栈保持不变：Tauri v2 + React 19 + TypeScript + Vite + Rust + Zustand + xterm.js + Tailwind

## 一、总体建议：渐进重构，不要推倒重写

当前项目已具备可复用基础：

- **终端**：本地 PTY、SSH、xterm.js、分屏、搜索。
- **文件**：SFTP 浏览与传输、本地目录浏览。
- **编辑**：已有独立 Monaco 编辑器窗口，支持本地/SFTP 文件读写。
- **Git**：已有基础 `git status`。
- **基础设施**：连接配置、系统钥匙串、known hosts、主题、i18n、多窗口同步、统一错误协议。

重构重点：

> **从"以终端 Session 为中心的应用"，调整为"以工作台 Workbench 为中心，编辑器、终端、Git、远程桌面都是其中一种工作视图"。**

## 二、产品定位与边界

### 目标定位

轻量、本地优先的开发者工作台：文本编辑、本地/SSH 终端、SFTP 文件管理、本地 Git 操作、RDP/VNC 图形远程访问。语言能力全部内置、固定，不提供插件系统。

### 明确不做

- 不支持 LSP；不做语义补全、定义跳转、引用查找、语义诊断、自动重构。
- 不做调试器和 DAP。
- 不做插件 API、插件进程、扩展市场、用户脚本。
- 不做远程开发服务器。
- 首版不做三方合并、复杂 Git 图形历史、协作编辑。
- RDP 首版不做音频、USB、打印机、驱动器重定向、RemoteApp。

Tree-sitter 语法、主题、命令均作为**应用内置静态能力**，不设计成可安装插件。

## 三、目标工作台结构

```text
┌──────────────────────────────────────────────────────────┐
│ 顶部：工作区 / 标签 / 全局命令入口                        │
├────────────┬─────────────────────────────────────────────┤
│ 左侧栏     │ 中央工作区                                  │
│  Explorer  │ - 文本编辑器标签                            │
│  Git       │ - Diff 编辑器                               │
│  Hosts     │ - RDP/VNC 桌面                              │
│  Files     │ - 欢迎页                                    │
├────────────┴─────────────────────────────────────────────┤
│ 底部面板：Terminal / Transfers / Output                  │
└──────────────────────────────────────────────────────────┘
```

现有右侧 Info/Files 面板暂时保留，编辑器与底部终端稳定后再决定是否合并。

### 核心模型拆分

```ts
WorkbenchTab = EditorTab | DiffTab | TerminalTab | RemoteDesktopTab
```

- **WorkbenchTab**：用户看到的 UI 标签和布局。
- **RuntimeSession**：PTY、SSH、SFTP、RDP、VNC 等真实后端资源。
- **EditorDocument**：文件内容、dirty 状态、语言、版本、保存状态。

关键规则：

1. 编辑器文档不再等同于终端 Session。
2. 标签关闭与后端资源释放分别处理。
3. 远程文档不能只依赖一个临时 SFTP explorer session；编辑器打开期间必须持有或引用有效连接。
4. 运行中的终端、RDP/VNC 会话默认不持久化；只持久化工作区、布局和必要的标签元数据。

## 四、各模块重构方案

### 1. 文本编辑器

**内核**：保留 Monaco standalone 核心，裁剪语言服务：

- 移除 TypeScript、CSS、HTML、JSON 的 language service Worker。
- 不接入任何 LSP。
- 只保留编辑、查找替换、括号匹配、缩进、Diff 等基础功能。
- 未知语言和超大文件退化为普通文本或简单高亮。

**Tree-sitter 高亮架构**（⚠️ 2026-11-18 产品决定：暂缓实施，语法高亮先由 Monaco Monarch tokenizer 提供，详见进度记录）：

```text
Monaco Document
      │ 增量 edits + version
      ▼
独立 Web Worker
      ├─ web-tree-sitter / WASM
      ├─ 内置 grammar manifest
      └─ 增量语法树
      ▼
可见范围高亮结果 → Monaco 高亮适配层
```

原则：

- Tree-sitter 放在 Worker，避免输入时阻塞 UI。
- 使用增量 `edit`，不要每次按键重新解析全文。
- 每个请求带 `documentId + version`，丢弃过期结果。
- 优先计算可见区域。
- 不通过 Tauri IPC 做每次按键的高亮请求。
- grammar 随应用打包，用户不能动态安装。
- 首批语言：Rust、TS/TSX、JS/JSX、JSON、TOML、YAML。

**文档管理**：

- Monaco Model 由独立 `EditorDocumentManager` 管理。
- Zustand 只保存标签、dirty、路径、语言等元数据，不保存完整文本。
- 保存时直接从 Model 读取内容。
- 保留各标签 cursor、scroll、selection 等视图状态。
- 支持 dirty 关闭确认、保存失败保留内容。
- 首版明确 UTF-8；保留 LF/CRLF。
- 检测二进制文件和文件大小，超出限制时只读或拒绝打开。
- 检测磁盘文件变化，保存前提示覆盖冲突。
- 本地保存复用原子写能力；远程保存失败不清空 dirty 状态。
- 独立 `editor` 窗口逐步迁移为主窗口编辑标签，迁移期保留兼容入口。

### 2. 终端与 SFTP

- 保留现有 PTY、SSH、xterm.js 实现。
- 终端移动到底部面板，保留分屏、搜索和重连。
- 新建本地终端默认 cwd 使用当前工作区。
- 从文件树可执行"在此处打开终端"。
- SSH Session 仍可关联 SFTP 文件面板。
- 本地文件和 SFTP 文件统一通过 EditorDocument 打开，底层使用不同 IO adapter。
- 明确资源引用关系，避免关闭文件浏览标签后导致正在编辑的远程文件断连。

现有 FTP/FTPS 保持禁用，不纳入本次范围。

### 3. Git

首版只支持**本地工作区 Git**。SSH 远程目录中的 Git 操作先通过远程终端完成。

**后端**：把 `workspace.rs` 中同步执行的 Git 逻辑拆成独立 `git.rs`：

- 异步进程或阻塞任务池，不阻塞 Tauri 主线程。
- 继续调用系统 Git，首版不引入 libgit2。
- 使用参数数组，不经 shell 拼接。
- 使用 `porcelain v2 + -z` 等稳定输出格式，正确处理空格、中文和 rename。
- 非交互操作禁用终端密码提示，认证失败返回可理解错误。

**功能顺序**：

- 第一阶段：分支与 ahead/behind、staged/unstaged/untracked、Diff、stage、unstage、discard（二次确认）、commit、简洁提交历史。
- 第二阶段：分支列表/创建/切换、fetch/pull/push、认证失败时"在终端中继续"降级入口。

暂不做交互式 rebase、cherry-pick、复杂 stash 和三方冲突解决。

**UI 与刷新**：

- 左侧独立 Git 视图；文件树显示简洁 Git 状态。
- 编辑器保存、终端目录变化、Git 操作完成后防抖刷新。
- 后续加入 Rust 文件 watcher，忽略 `.git`、构建目录和大型依赖目录。
- 不在每次按键后刷新整个 Git 状态。

### 4. RDP / VNC / Windows 远程访问

默认"Windows 远程访问"指 **RDP 图形桌面**；WinRM、SMB 等另立需求。

**连接模型**：`ConnectionProfile` 逐步调整为协议特定配置（SSH / RDP / VNC / 本地），旧 `connections.json` 通过版本化迁移继续可读。密码等敏感信息仍进系统钥匙串。

**图形会话架构**：

```text
RemoteDesktopTab
      │ 键盘 / 鼠标 / 控制命令
      ▼
Rust RDP/VNC Service
      │ 解码后的帧或增量区域
      ▼
高效帧传输（不使用 base64 JSON 持续传帧）
      ▼
Canvas / WebGL Renderer
```

- RDP 和 VNC 独立后端实现，共享生命周期、画布和输入层。
- 不使用 xterm.js 承载远程桌面。
- RDP 可评估 IronRDP 等 Rust 实现；VNC 单独评估维护状态和加密能力。
- RDP NLA/TLS 与服务端证书校验；不受信任证书必须显式确认。
- VNC 非加密认证显示明确安全提示。

**首版功能**：连接/断开/手动重连、单显示器、键鼠滚轮、自适应窗口与手动缩放、基础剪贴板、连接状态与错误展示。

RDP 与 VNC 拆成两个独立里程碑，优先 RDP；若图形管线风险高，可先用 VNC 验证渲染和输入层。

## 五、Rust 与前端模块调整

### Rust 目标结构

```text
src-tauri/src/
├── config/              # 配置与迁移
├── connections/         # Profile 与凭据引用
├── terminal/            # 本地 PTY、SSH 终端
├── sftp/                # 文件与传输
├── workspace/           # 工作区、目录、文件 watcher
├── document_io/         # 本地/远程文档读写
├── git/                 # Git 命令与输出解析
├── remote_desktop/
│   ├── rdp/
│   └── vnc/
├── session/             # 共享生命周期与资源登记
└── error.rs
```

新功能先按此边界建设，再逐步迁移旧代码，避免纯结构性大改。

### 前端目标结构

```text
src/
├── workbench/           # Shell、Tab、Panel、命令
├── workspace/           # 工作区与文件树
├── editor/              # Document、Monaco、高亮 Worker
├── terminal/
├── git/
├── connections/
├── remote-desktop/
├── transfers/
├── shared/
└── stores/
```

新增 IPC 统一放 `src/lib/tauri-*.ts`，错误继续使用 `PuckError`，Rust command 必须统一注册。

## 六、分阶段实施计划

| 阶段 | 主要交付 | 验收门槛 |
|---|---|---|
| 0. 基线与技术验证 | 现有功能 smoke 清单；Monaco + Tree-sitter PoC；RDP 帧传输 PoC；配置迁移方案 | 证明高亮、WASM、远程帧通道可行，再进入正式开发 |
| 1. Workbench 基础 | WorkbenchTab、Document、RuntimeSession 分离；新主布局；现有终端接入 | 原有本地/SSH 终端、SFTP、设置和连接管理不回归 |
| 2. 编辑器主功能 | 多标签编辑、本地/SFTP 文件、保存与冲突处理、Tree-sitter 首批语言 | 连续编辑不卡顿；dirty/关闭/保存失败路径正确 |
| 3. 工作区与终端整合 | 工作区文件树、cwd 联动、底部终端、编辑器与文件管理统一 | 关闭任意标签不会错误释放其他标签使用的资源 |
| 4. Git 第一阶段 | 状态、Diff、stage、commit、历史；异步 Git 后端 | 大仓库操作不阻塞 UI；特殊路径解析正确 |
| 5. Git 第二阶段 | 分支、fetch/pull/push、认证降级 | 网络失败和认证失败可恢复，不静默破坏工作区 |
| 6. RDP | Profile、凭据、证书信任、画布、输入、重连 | 1080p 常规局域网操作可用；长时间连接无持续内存增长 |
| 7. VNC | 复用远程桌面框架，实现 VNC 后端 | 键鼠、缩放、断线处理和安全提示完整 |
| 8. 发布收尾 | 性能、配置迁移、三平台验证、文档更新 | 构建通过，旧配置可升级，无敏感信息泄漏 |

每个阶段可独立合并和发布，不长期维护无法运行的"大重构分支"。

## 七、配置、迁移与安全

### 配置迁移

- 不覆盖或删除现有 `config.toml`、`connections.json`、known hosts。
- 写入前保留备份，增加 schema version。
- 新增持久化区段必须同步修改 Rust `config.rs` 的 section const、`PuckConfigFile` 字段、`UI_SECTIONS`、读取/写入 match 分支，以及前端 `PUCK_CONFIG_KEYS`。
- 修复现有 `hosts_layout` 白名单问题。
- 新 Store 不默认全部持久化；Session、文档内容和远程帧保持内存态。

### 安全底线

- 密码、私钥口令、RDP/VNC 凭据只进入系统钥匙串。
- 日志不记录密码、完整认证报文和桌面帧。
- RDP 证书信任与 SSH known hosts 分开管理。
- Git 和外部进程调用不经过 shell 字符串拼接。
- 文件删除、Git discard、远程覆盖等危险操作需要确认。
- 新窗口和 IPC 能力同步收紧 Tauri capability。

## 八、测试与发布门槛

先覆盖高风险纯逻辑：

- Rust：Git 输出解析、配置迁移、路径处理、会话状态转换。
- 前端：Profile 迁移、Tab/Document 状态、dirty 与关闭逻辑。
- Tree-sitter：增量 edit、版本乱序、Worker 异常后的纯文本降级。
- 手工矩阵：本地/SFTP 编辑、SSH 重连、Git 网络失败、RDP/VNC 断线和窗口缩放。

每阶段至少执行：

```bash
npm run build
cd src-tauri && cargo check
```

当前 clippy 已有基线问题，重构期只要求**不新增警告**。

## 九、开发顺序

> **Workbench 基础 → 编辑器 → 终端整合 → Git → RDP → VNC**

尽早得到可日常使用的版本，把风险最高的图形远程协议隔离在后期独立里程碑中。

## 十、进度记录

### 阶段 0 / 1（进行中）

- [x] 保存本计划（本文件）。
- [x] 基线验证：`cargo check` ✅（仅历史 dead-code warning）、`npm run build` ✅。
- [x] 基线证据：构建产物中 `ts.worker` 7MB / `css.worker` 1MB / `html.worker` 693KB / `json.worker` 383KB，证实 Phase 2 需裁剪 Monaco 语言服务 Worker。
- [x] 修正过时文档：`hosts_layout` 白名单问题在当前代码中已修复，更新 `README.md` 与 `AGENTS.md` 描述。
- [x] Phase 1 切片 1（类型与文档层）：
  - `src/types/workbench.ts`：`WorkbenchTab` 联合类型、`EditorDocumentMeta`、`DocumentSource`、`RemoteDesktopProtocol`。
  - `src/editor/document-id.ts`：`local:<path>` / `remote:<sessionId>:<path>` 标识符编解码。
  - `src/editor/document-io.ts`：`DocumentIo` 接口 + 本地/SFTP 适配器（IPC 统一走 `tauri-*.ts`）。
  - `src/editor/editor-document-manager.ts`：文档注册表（open/markEdited/save/close、dirty、version 递增、subscribe/getRevision 供 useSyncExternalStore）。
- [x] Phase 1 切片 2（主窗口标签栏）：
  - `src/stores/workbench-store.ts`：编辑器标签栏 store，只存标签元数据（documentId/title/path）+ 激活态，不持久化、不存文本。
  - `src/lib/open-in-workbench.ts`：`openFileInWorkbench` 打开入口。
  - `src/components/workbench/workbench-editor-area.tsx`：标签条 + Monaco 视图 + Cmd/Ctrl+S 保存（xterm 内按键不拦截）+ dirty 关闭确认。
  - `src/layout/app-shell/main-panel.tsx`：编辑器区域置于终端上方；无标签时 UI 与原布局完全一致。
  - `local-file-explorer.tsx` / `remote-file-explorer.tsx`：文件树打开文件改为主窗口编辑标签；独立 editor 窗口入口 `open-editor-window.ts` 迁移期保留。
  - i18n：`editor` namespace 新增 `closeTab`、`confirmCloseDirty`（zh-CN / en-US 同步）。
  - 验证：`npm run build` ✅（20.17s）。
- [x] Phase 1 收尾（命令面板集成）：
  - `src/lib/workbench-editor-actions.ts`：共享保存/关闭 actions（编辑器区域与命令面板复用，含 dirty 确认与 i18n toast）。
  - `src/components/workbench/workbench-editor-area.tsx`：重构为使用共享 actions。
  - `use-palette-commands.ts`：新增 `action-open-file`（dialog 选文件）、`action-save-editor-tab`、`action-close-editor-tab`（无激活标签时 disabled）。
  - i18n：`command-palette` namespace 新增 `openFile`/`saveEditorTab`/`closeEditorTab`（zh-CN / en-US 同步）。
- [x] Phase 2a：裁剪 Monaco 语言服务 Worker：
  - `src/lib/monaco.ts`：`loadMonaco()` 统一入口，运行时动态加载 `editor.api.js + editor.all.js`（全部编辑器功能、零语言服务），类型经主入口 `import type` 获取。
  - `src/lib/monaco-basic-languages.ts`：按需注册 20 个常用语言的 Monarch 语法高亮（同步 tokenizer，非 LSP，无 worker）。
  - `src/lib/monaco-setup.ts`：`getWorker` 只保留基础 editor worker。
  - `src/components/editor/monaco-editor-pane.tsx`：三处 `import("monaco-editor")` 改为 `loadMonaco()`。
  - **成果（构建产物对比）**：`ts.worker` 7010KB / `css.worker` 1030KB / `html.worker` 693KB / `json.worker` 383KB / `lspLanguageFeatures` / `tsMode` / `cssMode` 等 chunk 全部移除，仅剩基础 `editor.worker` 251KB；Monaco 改为懒加载（`editor.api2` 2.6MB 按需），index 主包回到 1.54MB；产物总体积约 14.7MB → 约 4.4MB（约 -70%）；构建时间 20.9s → 6.4s。
- [⏸] Phase 2b（tree-sitter 高亮 Worker PoC）：**按产品决定暂缓**（2026-11-18）。已试装 `web-tree-sitter@0.27.2` + `tree-sitter-rust@0.24.0` 并确认链路可行（官方包自带 wasm + highlights.scm，Vite `?url`/`?raw` 可用），随后按用户指示卸载依赖、清理注释；语法高亮现阶段完全由 Monarch 提供。后续若恢复，从本条记录的依赖版本继续。
- [x] Phase 4 第一阶段（Git 后端重构）：
  - `src-tauri/src/git.rs`（新模块）：异步 Git 命令层 —— 参数数组调用（无 shell 拼接）、`GIT_TERMINAL_PROMPT=0` 禁用交互提示、tokio 异步执行不阻塞主线程；`status --porcelain=v2 -z --branch` 稳定格式解析（纯函数 `parse_status_v2`）。
  - 新增字段：`upstream`/`ahead`/`behind`（`# branch.ab` 头）、`origPath`（rename 记录），前端 `types/workspace.ts` 与 `tauri-workspace.ts` 解析同步。
  - `workspace.rs`：移除同步 git 实现（`run_git`/`git_status_inner`/`parse_porcelain_path`），`resolve_path` 开放为 `pub(crate)` 供 git 模块复用；`lib.rs` 注册 `git::git_status`（命令名不变，前端 `gitStatus()` 无需改动）。
  - `Cargo.toml`：tokio 增加 `process` feature。
  - **14 个 Rust 单元测试全部通过**（项目首批自动化测试）：porcelain-v2 各记录类型（staged/unstaged/MM/untracked/rename/unmerged/ignored）、分支头与 ahead/behind、detached HEAD、含空格与中文的路径、`splitn` 列数差异（`1`=9 列 / `2`=10 列），以及一个真实 git 临时仓库的端到端集成测试。
  - 真实环境验证还抓到并修复一个 bug：git 只接受 `--porcelain=v2`（等号），连字符形式 `--porcelain-v2` 会直接报错。
  - 验证：`cargo check` ✅（8 条 warning 全部为基线已有，零新增）、`cargo test` ✅ 14 passed、`npm run build` ✅。
- [x] Phase 4 第二阶段（Git UI 与操作）：
  - Rust 新命令：`git_blob_content`（index/HEAD blob 读取，供 Diff 双栏文本）、`git_stage`、`git_unstage`、`git_discard`（`git restore --worktree`，仅 tracked 修改）、`git_commit`；全部走参数数组 + `GIT_TERMINAL_PROMPT=0`。
  - `run_git` 拆分 raw/trimmed 两种输出：blob 内容保留尾部换行（真实测试抓到的第二个 bug——统一 trim 会丢失文件末尾换行，破坏 diff 正确性）。
  - `src/lib/tauri-git.ts`：git IPC 统一收口（gitStatus 从 tauri-workspace 迁入 + 5 个新命令封装）。
  - 工作台标签模型扩展：`WorkbenchTabItem = editor | diff` 联合（`workbench-store.ts`），Diff 对比文本独立存放于 `src/editor/diff-content.ts`（不进 Zustand）；`workbench-tab-area.tsx`（替代 workbench-editor-area）统一渲染编辑器/Diff 标签；新组件 `monaco-diff-pane.tsx`（Monaco DiffEditor，只读双栏，模型随卸载释放）。
  - `git-panel.tsx` 重写：分支 + upstream + ahead/behind 展示；staged/unstaged 文件点击打开 Diff 标签（staged=HEAD↔index，unstaged=index↔工作区，新文件一侧为空文本）；stage/unstage/discard 按钮（discard 需 confirm，unmerged 不提供）、untracked stage；commit 输入框（⌘⏎ 提交）+ 提交后刷新；操作失败 toast 走 `parsePuckError`。
  - i18n：`info` namespace 新增 `gitStage/gitUnstage/gitDiscard/gitDiscardConfirm/gitCommit/gitCommitPlaceholder/gitCommitHint/gitAheadBehind`；`editor` namespace 新增 `diffUnavailable`（zh-CN / en-US 同步）。
  - 端到端测试扩展：真实 git 临时仓库验证修改→worktree diff→stage→staged diff→commit→clean→再修改→stage→unstage→discard→clean 完整工作流，**14 个测试全部通过**。
  - 验证：`cargo check` ✅（零新增 warning）、`cargo test` ✅ 14 passed、`npm run build` ✅（5.98s）。
- [x] Phase 4 第三阶段（提交历史与分支切换）：
  - Rust 新命令：`git_log`（`\u{1f}` 字段 / `\u{1e}` 记录的稳定格式，默认 20 条）、`git_branches`（NUL 分字段 + 行分记录，`%(HEAD)` 标记当前）、`git_checkout`（参数数组；工作区冲突时 git 拒绝并透出错误）；`parse_log` / `parse_branches` 纯函数解析。
  - 前端：`types/workspace.ts` 新增 `GitCommitEntry`/`GitBranchEntry`；`tauri-git.ts` 新增 `gitLog`/`gitBranches`/`gitCheckout` 封装。
  - `git-panel.tsx`：分支名变为 dropdown 触发器（列出本地分支、当前分支打勾、点击切换并刷新，切换失败 toast）；文件分组下方新增「提交历史」区（短哈希 + 主题 + 作者，title 显示完整日期）；历史/分支加载失败静默降级为空列表（空仓库场景）。
  - i18n：`info` namespace 新增 `gitHistory`/`gitSwitchBranch`（zh-CN / en-US 同步）。
  - 测试踩坑记录：git 2.54 拒绝带空格的分支名（check-ref-format 规则），测试分支名改为 `feature-zh分支`；`parse_log` 字段分隔符为 `\u{1f}` 而非 NUL，测试数据随之修正。
  - 验证：`cargo test` ✅ **18 passed**（新增 log/branch 解析与真实仓库 log·branches·checkout 工作流）、`cargo check` ✅ 零新增 warning、`npm run build` ✅（5.76s）。
- [x] Phase 4 第四阶段（fetch/pull/push 网络操作 + 认证降级）：
  - Rust 新命令：`git_fetch`（`--all --prune`）、`git_pull`（**`--ff-only`**，分叉时 git 拒绝、绝不静默合并/变基）、`git_push`（无 upstream 时自动 `--set-upstream origin <branch>` 发布当前分支）。
  - 结构化结果：`GitNetworkResult { ok, errorKind, message }`——认证/网络类失败以 `ok: false` 返回而不是命令错误；`classify_network_error` 纯函数把 git 输出分类为 `auth`（Authentication failed / terminal prompts disabled / Permission denied…）、`no_upstream`、`network`（Could not resolve host / does not appear to be a git repository…），其余仍按硬错误透出。
  - 前端 `git-panel.tsx`：分支行新增 Fetch/Pull/Push 三按钮（含 loading 禁用）；失败 toast 按类别显示标题 + git 原始错误描述 + **「在终端中重试」action**（把 `git fetch/pull/push` 命令写入当前活动终端会话，用户可交互输入凭据——即计划中的认证降级入口）；成功后自动刷新。
  - i18n：`info` namespace 新增 `gitFetch/gitPull/gitPush/gitFetchDone/gitPullDone/gitPushDone/gitAuthFailed/gitNetworkFailed/gitNoUpstream/gitRetryInTerminal/gitRetryFailed`（zh-CN / en-US 同步）。
  - 测试踩坑记录：porcelain-v2 配置 upstream 后 `branch.ab` 始终输出（同步后为 `+0 -0` 而非缺省）；真实集成测试抓到过一次自身遗漏（clone2 忘记 push）。
  - 验证：`cargo test` ✅ **20 passed**（新增网络错误分类 + 本地 bare remote 全流程：push 自动发布 → clone2 推进 → fetch behind=1 → pull 快进 behind=0 → 再 push 远端 HEAD 一致 → 无效远端分类为 network）、`cargo check` ✅ 零新增 warning、`npm run build` ✅（6.04s）。
- [x] Phase 3（联动收尾）：
  - **终端 cwd 联动**：`open_local_terminal` 新增 `cwd` 参数（`~` 展开 + 目录校验，无效路径静默回退 home）；`TerminalPane` 在 PTY 创建时一次性读取 `session.cwd`（不订阅，避免 OSC7 更新导致终端重建）；`NewTerminalMenu`（默认 + 指定 shell）与命令面板「新建本地终端」均以活动本地终端的 cwd 作为新终端初始目录（`activeWorkspaceCwd()`）；文件树新增**「在此处打开终端」**按钮（以当前浏览目录创建终端）。
  - **远程文档连接保活**：`sftp-explorer-session.ts` 提取 `ensureSftpSession(sessionId, profile)`；新增 `src/editor/remote-session-registry.ts` 引用计数注册表——远程文档打开时由编辑器独占 `editor:<connectionId>` SFTP 会话（与 explorer 会话解耦，关闭文件浏览面板不中断编辑），documentId 以 connectionId 为键跨 explorer 会话去重，重复打开只聚焦已有标签，最后一个文档关闭时释放后端会话；凭据取消/连接失败回滚计数并 toast。
  - **Rust 文件 watcher**：新增 `src-tauri/src/watch.rs`（`notify` v7）——按规范化路径去重注册递归监听，400ms 防抖合并事件，忽略 `node_modules/target/dist/.next/.turbo/.cache/.DS_Store`，`.git` 变化保留以驱动 Git 面板刷新；`workspace:changed` 事件广播；`start/stop_workspace_watch` 命令注册。前端 `useWorkspaceWatch` hook（模块级引用计数，首挂载启动/末卸载停止，回调经 ref 转发），Git 面板与本地文件树均接入**静默刷新**（不闪 loading）。
  - i18n：`info` namespace 新增 `openTerminalHere`（zh-CN / en-US 同步）。
  - 验证：`cargo check` ✅（8 条基线 warning，零新增）、`cargo test` ✅ 20 passed、`npm run build` ✅（6.93s）。
- [x] 阶段 6 第一切片（RDP/VNC 连接模型 + 后端骨架 + 工作台标签）：
  - **连接模型扩展**：`ConnectionProtocol` 新增 `rdp`/`vnc`（默认端口 3389/5900）；协议分类重构为三组（终端文件类 ssh/sftp、远程桌面类 rdp/vnc、未实现 ftp/ftps）；连接表单支持 RDP/VNC——协议下拉启用、端口随协议切换、认证方式锁定 password（RDP 显示用户名，VNC 仅共享密码）、校验规则按协议分支；`profileToForm` 端口默认值按协议取值。
  - **Rust 骨架** `src-tauri/src/remote_desktop.rs`：`RemoteDesktopRegistry` 会话注册表（global 单例）+ `start_remote_desktop`/`stop_remote_desktop`/`list_remote_desktop_sessions` 命令；连接经 `session:status` 事件驱动（creating → failed，错误码 `desktop_backend_unimplemented`），失败通过事件传递（与 SSH host-key 流一致）；代码内 TODO(phase-6) 标注 IronRDP 接入点。
  - **工作台远程桌面标签**：`WorkbenchTabItem` 联合新增 `remoteDesktop`（status: connecting/connected/failed）；`remote-desktop-session.ts` 入口（sessionId=randomUUID，invoke + `session:status` 订阅驱动状态，终态自动退订）；`workbench-tab-area.tsx` 占位视图（状态图标 + 错误 + 主机/协议信息）；关闭标签时 best-effort `stop_remote_desktop`。
  - **会话打开分流**：`open-profile-session.ts` 对 rdp/vnc 配置打开远程桌面标签而不是报错；i18n 新增 `remoteDesktop` namespace（connecting/connected/failed/backendPending/hostLabel/closeSession）+ `common:protocol.rdp/vnc`（zh-CN / en-US 同步，`i18n/index.ts` 注册三处更新）。
  - 验证：`cargo check` ✅（8 条基线 warning，零新增）、`cargo test` ✅ 20 passed、`npm run build` ✅（6.71s）。
- [x] 阶段 6 第二切片（RDP 证书信任链路 + IronRDP 依赖评估）：
  - **证书信任存储**（Rust `remote_desktop.rs`）：`rdp_trusted_hosts.json`（config 目录，原子写，与 SSH known_hosts 分离）；`trust_rdp_host` / `is_rdp_host_trusted` 命令；`start_remote_desktop` 增加 `password` 预留参数（不落盘不日志）。
  - **前端证书确认链路**：`remote_desktop:cert` 事件监听（sessionId→profile 登记）→ `RemoteDesktopCertDialog`（主机/端口/SHA-256 指纹展示，确认→写入信任存储并重连、拒绝→标签置为失败）；**绝不静默接受不受信任证书**；凭据经 `peekConnectionSecrets`/`resolveSecretsForConnection` 解析（支持「每次询问」），关闭标签清理登记与提示状态。
  - i18n：`remoteDesktop` namespace 新增 cert 相关 6 个 key（zh-CN / en-US 同步）。
  - **⚠️ IronRDP 依赖冲突（ADR，阻塞图形管线接入）**：
    - 冲突链 1：`russh 0.61.2` 精确锁定 `curve25519-dalek =5.0.0-rc.0`；`ironrdp-connector 0.10` → `picky =7.0.0-rc.25` 锁定 `=5.0.0-rc.1`。
    - 冲突链 2：`russh 0.65`（改用 `^5`，解析到正式版 5.0.0）与 `picky =5.0.0-rc.1` 仍冲突；`ironrdp-connector 0.9` → `picky =7.0.0-rc.23` 锁 `=5.0.0-pre.6` 亦冲突。
    - 根因：Cargo 不允许同一 major 的不同 pre-release/正式版共存，picky 全系列以 `=` 精确锁定不同 curve25519-dalek pre-release，与 russh 任何版本都无法同时满足。
    - 已实测失败组合：ironrdp 0.17+russh 0.61.2、ironrdp 0.17+russh 0.65、ironrdp 0.16+russh 0.61.2。
    - **决策选项**：A. 本地 vendor fork russh（`[patch.crates-io]` 指向放宽版本要求的本地副本，修复 pre-release API 差异）——立即可行、有 vendored 维护成本；B. 等待 picky/ironrdp 发布使用正式版 curve25519-dalek 的版本——零成本但时间不可控；C. 更换 RDP 协议实现（自研或其它库）——工作量最大。
    - **依赖已回退**（Cargo.toml 移除 ironrdp 系列），骨架/信任链路保持可编译；ironrdp 代码留待决策后重新引入。
  - 验证：`cargo check` ✅（8 条基线 warning，零新增）、`cargo test` ✅ 20 passed、`npm run build` ✅（6.31s）。
- [x] 阶段 6/7 决策（2026-11-19）：**按产品决定跳过 RDP/VNC 图形远程实现**。保留已完成的骨架（连接模型、远程桌面标签状态机、证书信任存储与确认链路、`desktop_backend_unimplemented` 失败事件）；IronRDP 依赖冲突 ADR 与恢复路径保留在上方记录，待上游生态兼容或决策变更时恢复。
- [x] 阶段 8 收尾（第一切片）：
  - **独立编辑器窗口移除**：文件编辑统一走主窗口工作台标签。删除 `editor_window.rs`（Rust 模块 + 命令注册）、`capabilities/editor.json`、`open-editor-window.ts`、`editor-shell.tsx`、`page/editor/`；`App.tsx` editor 分支与 lazy 路由清理；`app-window.ts` 移除 editor mode 与 URL 构造；`editor-params.ts` 移除 `getEditorParams`（保留 EditorFileSource/fileNameFromPath/guessMonacoLanguage）；i18n 移除 `shellLoading`。
  - **cargo check 基线清零**：8 条历史 warning 全部处理（未使用导入、unneeded mut、`require_credential`/`prompt_for_key`/`block_on` 死代码、`SessionKind::Sftp` 未构造 variant、`SftpSessionEntry.profile` 未读字段）；`require_credential` 保留 `#[allow(dead_code)]` 注明预留给 RDP/VNC 握手。**cargo check 现为 0 warning**；clippy --lib 从「全量失败」降至 9 条 lint 建议（未作为 gate）。
  - **README 更新**：能力清单补充工作台编辑器/Git 集成/工作区联动/远程桌面骨架；已知限制补充 RDP/VNC 骨架状态与独立编辑器窗口移除。
  - 验证：`cargo check` ✅ **0 warning**、`cargo test` ✅ 20 passed、`npm run build` ✅（6.29s）。
- [ ] 阶段 8 剩余：`npm run tauri dev` 三平台人工冒烟（清单见下）；发布打包验证；RDP/VNC 图形后端恢复（依赖上游生态或重新决策）。
- [ ] 待办：`npm run tauri dev` 人工冒烟（本地/SFTP 文件打开编辑保存、dirty 关闭确认、命令面板编辑器命令、Git 面板全操作 + 分支切换 + 历史 + fetch/pull/push 终端降级、新终端继承目录、保存后自动刷新、远程文件关面板后仍可保存、RDP/VNC 配置打开显示占位与证书确认）。
