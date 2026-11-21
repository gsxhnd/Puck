# Puck 文档：产品总览与当前能力

## 1. 产品定位

Puck 是一个轻量级的本地 / 远程代码工作台。它面向需要在同一个窗口中浏览文件、编辑文本、运行终端、查看 Git 历史并维护 SSH 端口转发的开发者，但不试图成为 VS Code 或完整 IDE。

核心取舍：

- **编辑与终端同级**：两者都有一等标签、快捷键、布局调整和独立生命周期。
- **Workspace 优先**：文件树、Git、新终端默认目录和端口转发都绑定当前 Workspace，而不是跟随某个终端的 `cd`。
- **本地与远程体验一致**：远程文件、终端、Git 和转发在 UI 上与本地保持同一套操作。
- **轻量边界**：不提供 LSP、调试器、任务系统、插件系统；Monaco 只使用 standalone 编辑器内核和 Monarch 基础高亮。

## 2. 当前核心能力

### Workspace

- 一个主窗口打开一个本地目录或一个 SSH 远端目录。
- 左侧提供 Files / Git / Ports 三个视图。
- Workspace、最近工作区、侧栏可见性、终端可见性和布局跨重启持久化。
- 切换 Workspace 时，编辑器 / Diff / Graph 标签按 `workspaceId` 隔离；运行中的终端保留自身租约，不因隐藏而中断。

### 文件与编辑

- 本地与远程文件树均支持：
  - 面包屑导航；
  - 隐藏文件切换；
  - 懒加载子目录；
  - 新建文件、新建目录、重命名、删除；
  - 双击文件进入 Monaco 编辑器。
- Monaco：
  - 多编辑器标签；
  - dirty 标记与关闭前确认；
  - `Cmd/Ctrl+S` 保存；
  - 保存失败保留 dirty 状态；
  - 双栏只读 Diff；
  - 本地文件原子写入；
  - 远程文件通过 SFTP 读写。
- 编辑器区域没有标签时显示空状态；终端可以独立继续使用。

### 终端

- 本地：Rust PTY + xterm.js，支持默认 shell / 指定 shell、resize、复制粘贴、链接、搜索、分屏。
- SSH：密码 / 私钥认证、系统钥匙串、每次询问、Host Key 确认、断线状态和手动重连。
- 终端拥有独立标签栏，新建、关闭、隐藏 / 显示不影响编辑器。
- SSH 终端在共享 SSH 连接上打开独立 shell channel。

### Git

- 左侧 Source Control：
  - status（porcelain v2）；
  - staged / unstaged / untracked 分组；
  - 文件 Diff；
  - stage / unstage / discard；
  - commit；
  - 分支切换；
  - fetch / pull / push；
  - ahead / behind。
- 本地 Git 直接调用本机 CLI。
- 远程 Git 通过共享 SSH 执行远端 CLI，参数逐个 POSIX 引用，`GIT_TERMINAL_PROMPT=0`。
- 网络操作失败时保留终端降级入口，用户可以在终端输入凭据。

### Git Graph

- 中央标签展示 `git log --all --topo-order` 的 DAG。
- 支持：
  - 分支 / tag 装饰；
  - 提交主题、作者、日期；
  - 父提交详情；
  - 分页加载；
  - merge / fork lane 布局；
  - 分页缺失父提交时绘制到当前页底部。
- Graph 是只读视图，不在首版提供 rebase / cherry-pick / interactive 操作。

### SSH local port forwarding

- 等价 `ssh -L`：
  - 只监听 `127.0.0.1` 或 `::1`；
  - 本地端口可填 `0` 自动分配；
  - 目标 host 从 SSH server 视角解析，支持远端 `localhost` 与域名；
  - 每个本地 TCP 连接独立 direct-tcpip channel；
  - stop 同步回收 listener 与全部 relay；
  - SSH 断开时自动停止并释放租约。

### 设置与连接

- Connections 只支持 SSH / SFTP。
- Settings / Connections 独立窗口。
- 跨窗口通过 `puck:config-changed` 同步。
- 历史 FTP / FTPS / RDP / VNC 配置在 rehydrate 时过滤，不再显示“即将支持”。

## 3. 明确边界

**永不做：**

- LSP / 语义语言服务 / 语言 worker；
- 插件系统与运行时扩展 API；
- 调试器与任务系统；
- IDE 级重构 / 定义跳转 / 跨文件诊断。

**当前不做：**

- Tree-sitter：Monaco Monarch 高亮已可用；Tree-sitter 只是未来可选高亮增强。
- SSH remote forward（`-R`）与 dynamic / SOCKS forward（`-D`）。
- SSH Agent、ProxyJump、目录同步。
- 用户自定义快捷键。

**已删除：**

- FTP / FTPS 协议类型与占位。
- RDP / VNC 远程桌面骨架、类型、命令、证书 UI 和 i18n namespace。

## 4. 主要用户流程

### 本地代码工作流

1. 通过 Workspace 切换器打开本地目录。
2. 左侧 Files 浏览文件，双击打开编辑器。
3. 底部终端默认在 Workspace 根目录启动。
4. 编辑器保存后本地 watcher 触发文件树与 Git 面板静默刷新。
5. Git 面板执行 stage / commit / push；Graph 查看全分支历史。

### 远程代码工作流

1. 打开 SSH Workspace，后端建立 Workspace 基础 SSH 租约。
2. 首次连接由 RemoteWorkspaceConnection 处理凭据与 Host Key。
3. Files 通过 SFTP channel 浏览并编辑远端文件。
4. Git 命令通过短期 SSH exec channel 在远端执行。
5. Ports 添加 local forward，把远端服务映射到本机 loopback。
6. 关闭 Workspace 时先停止 forwards，再释放基础租约；终端 / SFTP / Git 各自释放自己的租约，最后一个释放者断开 SSH。

## 5. 术语

| 术语 | 定义 |
| --- | --- |
| Workspace | 一个本地目录或 SSH 远端目录，是 Files / Git / Ports / 编辑器 / 终端的共同上下文 |
| Workspace Lease | 活动远程 Workspace 持有的基础 SSH 连接租约 |
| Owner ID | 终端、SFTP、Graph、Tunnel 等使用者持有的共享 SSH 租约标识 |
| Open Generation | 每次 SSH 打开尝试的编号，用于丢弃迟到的旧连接 |
| Profile | SSH / SFTP 连接配置，不含明文密码 |
| Session | 运行中的终端或 SFTP 逻辑会话 |
| Document | Monaco 编辑器中的本地 / 远程文件 |
| Known Hosts | 已信任的 SSH 主机密钥 |
