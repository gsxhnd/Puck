# Puck Terminal 文档：路线图、风险与验收

## 1. 当前完成状态

### Milestone 1：项目基础与 UI 骨架

状态：已完成。

- [x] 初始化 Tauri + React + TypeScript + Vite。
- [x] 建立 shadcn/ui 风格基础组件。
- [x] 建立主题与多语言基础设施。
- [x] 建立连接配置的数据模型。
- [x] 建立三栏 App Shell。
- [x] 建立 Settings / Connections 辅助窗口。

### Milestone 2：本地终端

状态：已完成基础功能。

- [x] 集成 xterm.js。
- [x] Rust 后端创建本地 PTY。
- [x] 前后端完成终端输入输出流。
- [x] 检测常见 shell 和 WSL。
- [x] 新建默认 shell 或指定 shell 会话。
- [x] resize、复制粘贴、链接识别、终端主题、字体设置。
- [x] 终端搜索和全部标签搜索。
- [x] 命令输入跟踪和命令大纲。
- [x] 两窗格分屏。

### Milestone 3：SSH 终端

状态：已完成基础功能。

- [x] 新建、编辑、复制、删除 SSH 连接。
- [x] 集成系统钥匙串保存密码和私钥口令。
- [x] 支持每次询问密码或私钥口令。
- [x] 支持 SSH 密码和私钥认证。
- [x] 打开远程交互式 shell。
- [x] host key 首次确认与持久化。
- [x] Settings 中管理 known hosts。
- [x] 断线状态展示和手动重连。
- [x] 快速连接和 ephemeral profile 清理。

### Milestone 4：SFTP 文件管理器

状态：已完成基础功能。

- [x] 从 SSH / SFTP 配置打开 SFTP。
- [x] 远程目录浏览、面包屑、刷新、隐藏文件切换。
- [x] 上传、下载、删除、重命名、新建目录。
- [x] 传输队列与进度展示。
- [x] 失败状态和重试。
- [x] 右侧 Files 面板支持 SSH 终端远程目录浏览。

当前未完成：传输取消、暂停、恢复。

### Milestone 5：工作区与命令入口

状态：已完成基础功能。

- [x] Sessions / Hosts 主侧栏页签。
- [x] 会话分组、排序、拖拽和自定义分组。
- [x] 主机分组、排序、拖拽和自定义分组 UI。
- [x] Info / Files / Git / Outline / Transfers 次面板。
- [x] 命令面板前缀范围和主要动作。
- [x] macOS 原生菜单栏常用动作。
- [x] Settings / Connections 多窗口同步。

当前风险：主机分组布局的 `hosts_layout` 配置区段尚未被 Rust 配置存储白名单接纳，暂不承诺跨重启可靠持久化。

## 2. 后续优先级

### P0：稳定化与一致性

- 修复 `hosts_layout` 持久化区段不一致。
- ~~为连接表单补充更明确的协议可用性提示，避免用户误以为 FTP/FTPS 已可用。~~ ✅ 已完成
- 增强连接失败、凭据缺失、host key、SFTP 操作失败的错误展示。
- 为关键 store 纯函数和配置迁移补充测试。
- 手动验证 macOS / Windows / Linux 基础路径。

### P1：SFTP 与终端体验增强

- 传输取消、暂停、恢复。
- 更完整的文件冲突处理和大文件失败恢复策略。
- 分屏布局持久化或更完整的多窗格模型。
- 命令大纲过滤、清理和更准确的命令解析。
- 快捷键自定义。

### P2：远程协议增强

- SSH Agent。
- ProxyJump。
- 端口转发。
- FTP / 显式 FTPS 文件管理。
- 目录同步。
- 远程文件预览或编辑。

## 3. 主要技术风险

| 风险 | 影响 | 缓解策略 |
| --- | --- | --- |
| PTY 跨平台差异 | 本地终端不可用或行为不一致 | 按平台封装 shell 检测和 PTY 启动，保留手动 shell 入口 |
| Windows WSL 检测差异 | WSL 发行版识别失败 | 允许普通 shell 入口继续工作，后续补充手动配置 |
| SSH host key 策略复杂 | 安全风险或连接体验差 | 保持首次确认和 known hosts 管理，错误 payload 结构化 |
| SSH/SFTP 库 API 变化 | 后端编译或行为回归 | 锁定依赖版本，升级前跑 `cargo check` 并手动验证 |
| 大文件传输 | UI 卡顿或失败恢复困难 | 后端流式传输，前端只接收进度事件；后续补取消和恢复 |
| 凭据存储差异 | 不同系统钥匙串行为不一致 | 抽象 Credential Service，并保留每次询问策略 |
| 快捷键与终端输入冲突 | 常用终端程序无法正常操作 | 区分全局快捷键和终端输入区域，后续自定义前必须做冲突检测 |
| 主题可读性 | 颜色组合导致不可读 | 应用主题和终端外观分离，人工验证主要主题 |
| `hosts_layout` 未写入 Rust 配置区段 | 主机分组跨重启丢失 | 将 `hosts_layout` 加入 Rust config schema 和 UI sections |
| `open_path_in_app` 仅 macOS | Windows/Linux 外部打开失败 | 为 Windows/Linux 增加平台实现或在 UI 中按平台隐藏不可用项 |
| FTP/FTPS UI 先于后端 | 用户误认为协议可用 | ~~文档和 UI 中明确标注预留状态~~ ✅ 已缓解：UI 禁用并拦截连接 |

## 4. 当前功能验收标准

### 4.1 本地终端

- 应用启动后可以按设置自动打开默认本地 shell。
- macOS/Linux 可识别 zsh 和 bash。
- Windows 可识别 PowerShell、cmd，并检测 WSL。
- 输入、输出、Ctrl+C、Ctrl+D、方向键正常。
- 调整窗口大小、切换标签、折叠面板和分屏后终端布局正常。
- 搜索当前标签和全部标签可用。
- 命令大纲记录输入命令并可跳转。

### 4.2 SSH

- 可以创建并保存 SSH 连接。
- 可以使用密码认证连接测试服务器。
- 可以使用私钥认证连接测试服务器。
- 可以选择保存凭据或每次连接时询问。
- 首次 host key 可以确认并保存。
- Settings 中可以查看并删除 known hosts。
- 断开连接后前端状态正确显示。
- 可以手动重连 SSH 标签。
- 关闭 SSH 标签会释放后端资源。

### 4.3 SFTP

- 可以从 SSH / SFTP 连接打开 SFTP 文件管理器。
- 可以列出远程目录。
- 可以上传和下载文件。
- 可以删除、重命名、新建目录。
- 传输进度、成功、失败状态正确。
- 失败任务可以重试。
- SSH 终端右侧 Files 面板可以浏览远程目录。

### 4.4 App Shell / 工作区

- 主窗口显示 Primary / Main / Second 三栏。
- Primary Panel 可在 Sessions / Hosts 间切换。
- Sessions 支持排序、分组、拖拽、重命名和关闭。
- Hosts 支持编辑、删除、连接和分组 UI。
- Second Panel 的 Info / Files / Git / Outline / Transfers 可切换。
- Settings 和 Connections 辅助窗口可以打开、聚焦和同步配置。
- 命令面板可以执行连接、视图切换、搜索、当前目录和动作命令。

### 4.5 UI / 主题 / 多语言

- 中英文切换后主要 UI 文案更新。
- Light、Dark、System 正常切换。
- 多套 color theme 下主界面可读。
- 终端字体、字号、光标闪烁、scrollback、复制选中设置生效。
- 连接列表、终端标签、文件管理器在 800x600 窗口下不重叠。
- 图标按钮有 tooltip 或可访问标签。

### 4.6 FTP / FTPS 后续验收

当前不适用。后续实现时至少需要验收：

- 可以创建 FTP 连接并浏览目录。
- 可以创建显式 FTPS 连接并浏览目录。
- 可以上传和下载文件。
- 认证失败、连接超时、权限不足有明确提示。

## 5. 测试策略

当前仓库没有独立测试脚本或测试文件。短期验证策略：

- `npm run build`：检查 TypeScript 和前端构建。
- `cd src-tauri && cargo check`：检查 Rust 后端编译。
- `git diff --check`：检查 Markdown 和代码空白问题。
- 手动验证本地终端、SSH、SFTP、设置窗口、连接窗口、命令面板和主题切换。

建议补充的测试：

Rust：

- shell 检测逻辑。
- 错误 payload 映射。
- 配置区段读写和迁移。
- 凭据 key 生成。
- Git status porcelain 解析。

TypeScript：

- 连接表单 payload 生成。
- i18n key 覆盖。
- sidebar / hosts 分组纯函数。
- terminal split 布局生成。
- command palette prefix 解析。

集成测试：

- 前端通过 mock IPC 测试终端事件流。
- Rust 使用可控测试服务器验证 SSH/SFTP。
- 传输队列测试成功、失败、重试。
- 多窗口配置同步。

## 6. 发布前检查清单

- 所有 Tauri IPC 命令已注册并记录。
- Tauri capabilities 只包含必要权限。
- 配置文件不包含明文密码。
- known hosts 与普通配置分离。
- 关闭标签会释放后端资源。
- 快速连接 session 关闭后清理 ephemeral profile 和凭据。
- 大文件传输不会阻塞 UI。
- 错误提示包含用户文案和技术细节。
- 默认主题下终端可读。
- `hosts_layout` 持久化问题已修复或在 release note 中明确说明。
- README 包含基础启动、开发命令、配置位置和已知限制。

## 7. 后续版本方向

V1.1：

- 修复主机布局持久化。
- 增强错误展示。
- 传输取消、暂停、恢复。
- 快捷键自定义。
- 基础测试覆盖。

V1.2：

- SSH Agent。
- ProxyJump。
- 端口转发。
- 更完整的分屏布局。
- 目录同步。

V2：

- FTP / FTPS。
- 远程文件预览和编辑。
- 云同步。
- 团队共享连接。
- AI 命令解释和工作流。
- 插件系统。
