# Puck Terminal 文档索引

本文档集以当前代码实现为基准，记录 Puck 的产品能力、架构边界、连接模型、UI 结构、风险和验收标准。

## 文档结构

- `01-overview-and-mvp.md`：产品定位、当前能力、限制和主要用户流程。
- `02-architecture-and-stack.md`：前后端分层、IPC、事件、配置存储、多窗口同步和权限边界。
- `03-connection-model-and-protocols.md`：连接 Profile、Session 生命周期、凭据策略、SSH、SFTP、FTP/FTPS 预留和错误处理。
- `04-ui-ux-and-theme-i18n.md`：三栏界面、命令面板、详情面板、主题、多语言、快捷键和可访问性。
- `05-roadmap-risks-and-acceptance.md`：当前完成状态、已知风险、验收标准、测试策略和后续版本方向。

## 当前功能基准

当前版本已经具备：

- 本地终端：PTY、xterm.js、多 shell、resize、复制粘贴、链接识别、搜索、终端主题。
- SSH 终端：连接配置、密码/私钥认证、系统钥匙串、每次询问密码/口令、host key 确认、断线重连。
- SFTP：远程目录浏览、上传、下载、新建目录、删除、重命名、传输队列和进度事件。
- 三栏工作台：Sessions / Hosts 主侧栏、主终端区、Info / Files / Git / Outline / Transfers 次面板。
- 工作区辅助：本地文件浏览、远程文件浏览、Git 状态、命令大纲、终端搜索、两窗格分屏。
- 命令面板：前缀范围、快速连接、本地 shell、连接打开、视图切换、当前目录操作、外部应用打开。
- 设置与连接管理：独立 Settings / Connections 窗口，跨窗口配置同步。
- 主题与 i18n：`zh-CN`、`en-US`，Light / Dark / System，应用配色主题和终端外观设置。

暂未实现或仅预留：

- FTP / FTPS 在连接模型中保留类型定义，但连接表单中已禁用并标注「即将支持」，无法创建或连接；Rust 后端尚未实现。
- SSH Agent、ProxyJump、端口转发。
- 传输取消、暂停、恢复。
- 快捷键自定义。
- 目录同步、远程文件预览、远程文件编辑。
- `open_path_in_app` 的非 macOS 实现。

## 当前文档原则

- 不把 SSH / SFTP、命令面板、分屏、设置窗口等已实现能力继续描述为未来规划。
- 不把 FTP / FTPS、SSH Agent、ProxyJump、端口转发等预留能力描述为可用。
- 明确敏感信息和普通配置的边界：连接配置写入 Puck 配置文件，密码和私钥口令写入系统钥匙串。
- 明确已知不一致：`hosts_layout` 前端持久化 key 尚未被 Rust 配置存储白名单接纳，主机分组布局暂不承诺跨重启可靠持久化。
