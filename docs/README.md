# Puck 文档索引

本文档集以当前代码为基准，描述轻量级本地 / 远程代码工作台的产品能力、架构、连接模型、UI 与验收标准。

## 文档结构

- [01-overview-and-mvp.md](01-overview-and-mvp.md)：产品定位、能力、用户流程、边界和术语。
- [02-architecture-and-stack.md](02-architecture-and-stack.md)：分层架构、共享 SSH、IPC、事件、配置存储与多窗口。
- [03-connection-model-and-protocols.md](03-connection-model-and-protocols.md)：Profile、Workspace、租约、凭据、Host Key、SFTP 与端口转发。
- [04-ui-ux-and-theme-i18n.md](04-ui-ux-and-theme-i18n.md)：Workspace 布局、编辑器、终端、Git Graph、主题与多语言。
- [05-roadmap-risks-and-acceptance.md](05-roadmap-risks-and-acceptance.md)：后续方向、风险、测试策略和验收矩阵。

## 当前功能基准

- Workspace：本地目录 / SSH 远端目录，Explorer、Git、Ports 三个左侧视图，中央编辑器，底部终端。
- 编辑：Monaco standalone（无 LSP）、多标签、dirty 状态、本地 / SFTP 读写、Diff。
- 终端：本地 PTY 与 SSH shell，独立标签、搜索、分屏、主题、字体。
- Git：本地与远程 status / Diff / stage / unstage / discard / commit / branch / fetch / pull / push，Git Graph 分页 DAG。
- 共享 SSH：终端、SFTP、远程 Git、端口转发复用同一连接并独立持有租约。
- 端口转发：local forward（`ssh -L`），loopback only，listener 与 relay 统一回收。
- 设置与连接：SSH / SFTP only；Settings / Connections 独立窗口并跨窗口同步。
- 国际化与主题：`zh-CN` / `en-US`，Light / Dark / System，多套配色。

## 边界

- 永不支持：LSP、语义语言服务、调试器、任务系统、插件系统。
- 未实现：Tree-sitter 高亮、SSH Agent、ProxyJump、`-R` / `-D` 转发、目录同步。
- 已移除：FTP / FTPS 占位、RDP / VNC 远程桌面骨架。
