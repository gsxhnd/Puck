# Puck Terminal 文档索引

本文档集以当前已实现的核心功能为基准，服务后续 UI 样式微调、交互收敛和功能增强。

## 文档结构

- `01-overview-and-mvp.md`：产品定位、当前核心能力、已知限制和主要用户流程。
- `02-architecture-and-stack.md`：前后端分层、IPC、状态模型、凭据和权限边界。
- `03-connection-model-and-protocols.md`：连接模型、Session 生命周期、SSH、SFTP、FTP/FTPS 预留和错误处理。
- `04-ui-ux-and-theme-i18n.md`：当前界面结构、主题、多语言、可访问性和 UI 微调检查清单。
- `05-roadmap-risks-and-acceptance.md`：已完成里程碑、当前 UI 微调阶段、风险、验收和后续方向。

## 当前功能基准

当前版本已经具备：

- 本地终端：PTY、xterm.js、多 shell、resize、终端主题。
- SSH 终端：连接配置、密码/私钥认证、系统钥匙串、host key 确认、断线重连。
- SFTP 文件管理：目录浏览、上传、下载、新建目录、删除、重命名、传输队列。
- App Shell：连接侧边栏、会话标签、设置页、主题、多语言。

暂未实现或仅预留：

- FTP / FTPS 后端。
- SSH Agent、ProxyJump、端口转发。
- 传输取消、暂停、恢复。
- 完整命令面板和全局快捷键体系。

## UI 微调原则

后续样式调整应优先改善：

- 视觉层级和空间利用率。
- 连接、会话、传输等状态反馈。
- 小窗口和中英文文本长度下的布局稳定性。
- Light / Dark / System 主题和终端主题的可读性。

样式调整不应破坏：

- 终端输入焦点和 xterm resize。
- SSH host key 首次确认流程。
- SFTP 传输队列事件更新。
- 连接配置与系统钥匙串分离存储策略。
