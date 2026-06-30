# Puck

Puck 是一个基于 Tauri v2、React 和 Rust 的桌面终端与文件传输工作台。它面向需要同时管理本地 shell、远程 SSH 会话、SFTP 文件操作和项目上下文信息的开发者。

当前版本重点是把终端、连接管理、文件浏览、命令面板和多窗口设置体验整合到一个三栏桌面工作台中。

## 当前能力

- 本地终端：Rust PTY、xterm.js 渲染、多 shell 检测、resize、复制粘贴、链接识别、搜索、终端主题和字体设置。
- SSH 终端：保存连接配置、密码和私钥认证、系统钥匙串、首次 host key 确认、断线状态展示和手动重连。
- SFTP 文件管理：远程目录浏览、上传、下载、新建目录、删除、重命名、传输队列和进度事件。
- App Shell：左侧 Sessions / Hosts 主侧栏，中间终端与文件工作区，右侧 Info / Files / Git / Outline / Transfers 详情面板。
- 工作区辅助：本地文件浏览、远程文件浏览、Git 状态、命令大纲、终端搜索、两窗格分屏、当前目录复制和打开。
- 命令面板：支持前缀范围、快速连接、本地 shell、视图切换、搜索、当前目录操作和外部应用打开。
- 设置与连接管理：独立 Settings / Connections 辅助窗口，支持跨窗口配置同步。
- 多语言与主题：当前支持 `zh-CN`、`en-US`，支持 Light / Dark / System 和多套应用配色。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 桌面壳 | Tauri v2 |
| 后端 | Rust、portable-pty、russh、russh-sftp、keyring |
| 前端 | React、TypeScript、Vite |
| UI | shadcn/ui 风格组件、Tailwind CSS、lucide-react |
| 终端 | xterm.js |
| 状态 | Zustand + Puck 配置存储 |
| 国际化 | i18next |

## 开发

安装依赖：

```bash
npm install
```

启动前端开发服务器：

```bash
npm run dev
```

启动 Tauri 桌面开发模式：

```bash
npm run tauri dev
```

构建前端：

```bash
npm run build
```

构建桌面应用：

```bash
npm run tauri build
```

检查 Rust 后端：

```bash
cd src-tauri
cargo check
```

当前仓库没有配置独立的单元测试或端到端测试脚本，文档中的验收以构建检查和手动验证为主。

## 配置与数据

- 统一配置文件：`~/.config/puck/config.toml`
- SSH known hosts：`~/.config/puck/known_hosts.json`
- 密码和私钥口令：系统钥匙串，key 形如 `puck.connection.<connectionId>.<field>`
- 运行中 session：前端内存状态 + Rust 后端 session registry，不随应用重启恢复

## 文档

详细文档见 [docs/README.md](docs/README.md)。

- [产品总览与当前能力](docs/01-overview-and-mvp.md)
- [架构与技术栈](docs/02-architecture-and-stack.md)
- [连接模型与协议](docs/03-connection-model-and-protocols.md)
- [UI、主题与多语言](docs/04-ui-ux-and-theme-i18n.md)
- [路线图、风险与验收](docs/05-roadmap-risks-and-acceptance.md)

## 已知限制

- FTP / FTPS 仍只是连接模型和 UI 预留，后端文件传输尚未实现。
- SSH Agent、ProxyJump、端口转发、目录同步、远程文件预览暂未实现。
- 传输队列支持进度、成功、失败和重试，但还不支持取消、暂停和恢复。
- 快捷键已有固定实现和只读设置页说明，但还不支持用户自定义。
- `open_path_in_app` 目前仅支持 macOS，其他平台会返回“不支持”错误。
- 前端存在 `hosts_layout` 持久化 key，但 Rust 配置区段尚未纳入该 key；因此主机分组布局暂不应被视为跨重启可靠持久化能力。
