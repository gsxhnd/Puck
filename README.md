# Puck

Puck 是一个基于 Tauri v2、React 19 和 Rust 的轻量级本地 / 远程代码工作台。它把文件树、Monaco 编辑器、本地与 SSH 终端、Git 以及端口转发放进同一个窗口，但不追求成为完整 IDE。

**产品边界：Puck 永远不提供 LSP、调试器、任务系统或插件系统。** 语法高亮使用 Monaco 的独立编辑器内核与 Monarch 基础 tokenizer；Tree-sitter 只作为未来可选的高亮增强，不会引入语言服务或插件机制。

## 当前能力

- **Workspace 主界面**：一个窗口打开一个本地目录或 SSH 远端目录；左侧为 Files / Git / Ports，中央为编辑器标签，底部为独立终端标签，底部状态栏显示路径、分支、语言和来源。
- **本地终端**：Rust PTY、xterm.js 渲染、多 shell 检测、resize、复制粘贴、链接识别、搜索、分屏、终端主题和字体设置。
- **SSH 终端**：密码 / 私钥认证、系统钥匙串、每次询问凭据、首次 host key 确认、断线状态展示和手动重连。
- **共享 SSH 连接**：同一 profile 的终端、SFTP、远程 Git 和端口转发复用一条物理 SSH 连接，各自持有独立租约；最后一个使用者释放后才断开。
- **本地 / 远程编辑**：Monaco 独立编辑器，多标签、dirty 状态、保存失败保持未保存、只读双栏 Diff；本地文件原子写入，远程文件经 SFTP 读写。
- **文件操作**：本地与远程文件树均支持浏览、新建文件、新建目录、重命名、删除、隐藏文件切换和刷新。
- **Git**：本地与远程工作区共用一套 Source Control UI，支持 status、Diff、stage / unstage / discard、commit、分支切换、fetch / pull / push 和 ahead / behind。
- **Git Graph**：中央标签中显示 `--all --topo-order` 的提交 DAG，支持分支 / tag 装饰、提交详情和分页加载。
- **端口转发**：支持 SSH local forwarding（等价 `ssh -L`），默认只监听 loopback，本地端口可填 `0` 自动分配，停止时回收 listener 和所有活动连接。
- **设置与连接管理**：Settings / Connections 独立窗口，跨窗口配置同步；支持 `zh-CN` / `en-US`、Light / Dark / System 和多套配色。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 桌面壳 | Tauri v2 |
| 后端 | Rust、portable-pty、russh、russh-sftp、tokio、keyring |
| 前端 | React 19、TypeScript、Vite |
| UI | shadcn/ui 风格组件、Tailwind CSS v4、lucide-react |
| 终端 | xterm.js |
| 编辑器 | Monaco standalone editor（无 language service / LSP） |
| 状态 | Zustand + Puck 配置存储 |
| 国际化 | i18next |

## 开发

```bash
npm install

# 仅前端（IPC 不可用，仅用于纯 UI 调试）
npm run dev

# 完整桌面应用
npm run tauri dev

# 前端类型与构建检查
npm run build

# Rust 编译检查
cd src-tauri && cargo check

# Rust 单元测试
cd src-tauri && cargo test
```

仓库没有 ESLint / Prettier / rustfmt 配置。`npm run build` 是唯一 TypeScript gate；Rust 逻辑解析器与安全路径处理带有 `#[test]`。

## 配置与数据

- 统一配置：`~/.config/puck/config.toml`
- 连接配置：`~/.config/puck/connections.json`
- SSH known hosts：`~/.config/puck/known_hosts.json`
- 密码和私钥口令：OS keychain，key 为 `puck.connection.<connectionId>.<field>`
- Workspace、面板布局和最近工作区持久化在 `config.toml` 的 `workspaces` / `shell_layout` 区段。
- 运行中的终端、编辑器标签、Git Graph 分页和端口转发不持久化，应用重启后清空。

## 明确不支持

- LSP、语义语言服务、调试器、任务系统、插件系统。
- FTP / FTPS：协议类型和“即将支持”占位已移除，历史配置 rehydrate 时会被过滤。
- RDP / VNC：图形远程骨架已删除。
- SSH remote forward（`-R`）和 dynamic / SOCKS forward（`-D`）。
- SSH Agent、ProxyJump、目录同步。
- SFTP 上传 / 下载传输队列。
- Monaco 已提供基础语法高亮；Tree-sitter 是未来可选增强，当前未接入。

## 文档

- [文档索引](docs/README.md)
- [产品总览](docs/01-overview-and-mvp.md)
- [架构与技术栈](docs/02-architecture-and-stack.md)
- [连接模型与协议](docs/03-connection-model-and-protocols.md)
- [UI、主题与多语言](docs/04-ui-ux-and-theme-i18n.md)
- [路线图、风险与验收](docs/05-roadmap-risks-and-acceptance.md)
- [重构决策记录](REFACTOR_PLAN.md)
