# Puck Terminal 设计开发文档：UI、主题与多语言

## 1. 设计原则

Puck Terminal 是工具型桌面应用，界面应优先服务高频操作：

- 信息密度适中，避免营销页式大面积装饰。
- 主要操作常驻，低频配置进入设置或菜单。
- 终端区域最大化可用空间。
- 错误、断线、传输状态要清晰可见。
- 主题和字体设置不能影响终端可读性。

## 2. 信息架构

```mermaid
flowchart TB
  App["App Shell"]
  Sidebar["Sidebar: Connections / Sessions"]
  Topbar["Topbar: Tabs / Commands / Status"]
  Main["Main Workspace"]
  Terminal["Terminal Pane"]
  Files["File Manager"]
  Queue["Transfer Queue"]
  Settings["Settings"]

  App --> Sidebar
  App --> Topbar
  App --> Main
  Main --> Terminal
  Main --> Files
  Main --> Queue
  Main --> Settings
```

## 3. 主要界面

### 3.1 App Shell

应用主界面包含：

- 左侧连接与会话侧边栏。
- 顶部标签栏。
- 主工作区。
- 底部或右侧传输队列入口。
- 全局命令面板入口。

布局要求：

- 默认启动后打开本地终端。
- 侧边栏可折叠。
- 多标签支持关闭、切换、重命名。
- 文件管理器和终端可以通过标签并存。

### 3.2 连接列表

连接列表需要支持：

- 按协议分组或筛选。
- 搜索连接。
- 新建、编辑、复制、删除连接。
- 从 SSH 连接打开终端或 SFTP。
- 从 FTP/FTPS 连接打开文件管理器。

连接卡片或列表项展示：

- 名称。
- 协议徽标。
- host 与 username。
- 最近连接时间。
- 连接状态。

### 3.3 终端工作区

终端工作区由 xterm.js 承载。

必须支持：

- 自适应容器尺寸。
- 复制、粘贴。
- 搜索终端内容。
- 清屏。
- 断开和重连。
- 字体和字号设置。
- 终端主题切换。

首版不要求：

- 分屏。
- 广播输入。
- session 录制。
- AI 命令建议。

这些能力可以作为后续版本扩展。

### 3.4 文件管理器

文件管理器用于 SFTP、FTP、FTPS。

界面元素：

- 路径面包屑。
- 文件列表。
- 上传按钮。
- 新建目录按钮。
- 刷新按钮。
- 右键菜单或更多操作菜单。
- 传输队列。

文件列表列建议：

- 名称。
- 类型。
- 大小。
- 修改时间。
- 权限或属性。

操作规则：

- 双击目录进入。
- 双击文件默认下载或打开操作菜单，首版建议默认下载。
- 删除操作需要确认。
- 上传下载需要进入传输队列。

### 3.5 设置页

设置页分区：

- General：语言、启动行为、默认 shell。
- Appearance：UI 主题、终端主题、字体、字号。
- Connections：凭据管理、host key 管理。
- Keyboard：快捷键查看与后续自定义预留。
- About：版本信息。

## 4. shadcn/ui 组件策略

使用 shadcn/ui 时遵循：

- Button：主要操作、图标按钮。
- Sidebar：连接与会话导航。
- Tabs：顶部会话标签。
- Dialog / Sheet：连接编辑、确认删除、设置面板。
- DropdownMenu / ContextMenu：文件和连接的更多操作。
- Command：全局命令面板。
- Table：文件列表。
- Badge：协议和状态。
- Progress：传输进度。
- Tooltip：图标按钮说明。
- Alert：连接错误、安全提示。
- Separator / Resizable：布局分隔。

不要为基础控件重复造轮子。特殊区域如 xterm.js 容器和文件表格可以封装业务组件，但底层交互控件优先复用 shadcn/ui。

## 5. xterm.js 集成策略

每个终端标签包含一个独立 xterm.js 实例。

推荐插件：

- `@xterm/addon-fit`：自适应容器尺寸。
- `@xterm/addon-search`：终端搜索。
- `@xterm/addon-web-links`：识别 URL。
- `@xterm/addon-clipboard`：按需要处理剪贴板增强。

事件规则：

- `onData` 将用户输入转发到 Rust。
- `onResize` 将列数和行数转发到 Rust。
- 后端 `terminal:data` 事件写入对应 xterm 实例。
- 组件卸载时 dispose xterm 实例和插件。

## 6. 主题系统

主题分为两层：

### 6.1 应用 UI 主题

应用 UI 主题控制：

- 背景。
- 前景文字。
- 边框。
- 侧边栏。
- 弹窗。
- 按钮。
- 状态色。

必须支持：

- Light。
- Dark。
- System。

### 6.2 终端主题

终端主题控制 xterm.js：

- foreground。
- background。
- cursor。
- selection。
- ANSI 16 色。

内置主题建议：

- Puck Dark。
- Puck Light。
- Solarized Dark。
- Solarized Light。
- One Dark。

应用 UI 主题和终端主题可以独立选择。例如应用为亮色，终端为暗色。

## 7. 多语言

首版至少支持：

- `zh-CN`。
- `en-US`。

语言资源按模块组织：

```text
src/i18n/locales/
  zh-CN/
    common.json
    connections.json
    terminal.json
    files.json
    settings.json
  en-US/
    common.json
    connections.json
    terminal.json
    files.json
    settings.json
```

文案规则：

- 主要 UI 文案必须使用 i18n key。
- 错误信息由 Rust 返回结构化错误码，前端映射成本地化文案。
- 技术细节可以保留原始英文，但需要有本地化摘要。
- 日期、时间、文件大小按当前语言格式化。

## 8. 快捷键

MVP 快捷键建议：

| 快捷键 | 功能 |
| --- | --- |
| Cmd/Ctrl + T | 新建本地终端 |
| Cmd/Ctrl + W | 关闭当前标签 |
| Cmd/Ctrl + K | 打开命令面板 |
| Cmd/Ctrl + , | 打开设置 |
| Cmd/Ctrl + F | 搜索当前终端或文件列表 |
| Cmd/Ctrl + Shift + C | 复制终端选中内容 |
| Cmd/Ctrl + Shift + V | 粘贴到终端 |

快捷键需要避免和终端程序常用控制键冲突。涉及终端输入的组合键必须特别测试。

## 9. 可访问性

基础要求：

- 图标按钮必须有 tooltip 或 aria-label。
- Dialog 和 Sheet 必须有标题。
- 键盘可以访问主要操作。
- 主题色对比度必须保证终端可读。
- 状态变化不能只依赖颜色，也需要文字或图标提示。

