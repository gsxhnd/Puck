# Puck 文档：路线图、风险与验收

## 1. 当前完成状态

### Workspace shell

- [x] 本地 / SSH Workspace。
- [x] 最近 Workspace 持久化。
- [x] Files / Git / Ports 左侧视图。
- [x] 编辑器与终端独立标签与布局。
- [x] Workspace-scoped editor / Diff / Graph tabs。
- [x] 底部状态栏。

### 编辑与文件

- [x] Monaco standalone 多标签编辑。
- [x] 本地 / SFTP Document IO。
- [x] dirty / save / close confirm。
- [x] 本地 / 远程 Diff。
- [x] 本地原子写。
- [x] 本地 / 远程新建、重命名、删除。
- [x] 文件树懒加载与隐藏文件切换。

### 终端与 SSH

- [x] 本地 PTY。
- [x] SSH shell。
- [x] 密码 / 私钥 / 钥匙串 / 每次询问。
- [x] Host Key 确认。
- [x] 共享 SSH transport + 独立租约。
- [x] Open generation 防迟到连接。
- [x] 手动重连。
- [x] 终端分屏与搜索。

### Git

- [x] 本地 status / diff / stage / commit / branch / network。
- [x] 远程 status / diff / stage / commit / branch / network。
- [x] 本地 / 远程 Git Graph。
- [x] 分页 Graph DAG。
- [x] 本地 watcher 刷新。
- [x] Git 网络失败终端降级。

### 端口转发

- [x] `ssh -L` local forwarding。
- [x] loopback only。
- [x] 本地端口 `0` 自动分配。
- [x] 多并发 TCP relay。
- [x] stop 回收 listener + relays。
- [x] SSH 断开自动停止。

### 协议清理

- [x] 删除 FTP / FTPS 类型与 UI 占位。
- [x] 删除 RDP / VNC 骨架、命令与证书链路。
- [x] 历史 unsupported profile rehydrate 过滤。

## 2. 测试与验证基线

必须全部通过：

```bash
npm run build
cd src-tauri && cargo check
cd src-tauri && cargo test
cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings
```

已有 Rust 测试覆盖：

- porcelain v2 status；
- log / graph log / branch 解析；
- 本地真实 Git workflow；
- 本地 bare remote fetch / pull / push；
- remote Git shell quoting 与 home path；
- UTF-8 stream 分包；
- atomic write。

前端目前无测试 runner。修改布局 / 状态逻辑时至少进行手动桌面冒烟。

## 3. 手动验收矩阵

### 本地 Workspace

1. 打开本地目录。
2. 文件树展开多级目录。
3. 新建文件 / 目录，重命名并删除测试项。
4. 双击文件编辑，修改后 dirty 出现。
5. `Cmd/Ctrl+S` 保存，watcher 静默刷新 Git / Files。
6. 关闭 dirty 标签，取消与确认路径都正确。
7. 新建多个终端，分屏与搜索正常。
8. 关闭全部终端，应用不退出，编辑器继续可用。
9. Git stage / unstage / discard / commit / fetch / pull / push。
10. 打开 Graph，确认分支、merge、refs、分页。

### 远程 Workspace

1. 打开 SSH Workspace，首次 Host Key 弹窗。
2. 确认 Files 能列出远端目录。
3. 新建 / 重命名 / 删除远端测试项。
4. 双击远端文件，编辑并保存。
5. 关闭 explorer / 全部终端，编辑器仍可保存。
6. Git status / diff / stage / commit / fetch / pull / push。
7. Graph 能显示远端全分支历史。
8. 添加 local forward，本地端口可访问远端服务。
9. stop forward 后端口立即不可连接。
10. 本地端口冲突返回可理解错误。
11. 断开 SSH 后 forward 状态停止。
12. 关闭 Workspace 后端口不再监听。

### 共享 SSH 生命周期

1. 同一 profile 打开 terminal + explorer + editor + Graph，只建立一条认证连接。
2. 关闭 terminal，editor / Git / forward 继续。
3. 关闭 explorer，editor 继续。
4. 关闭 Workspace，forwards 停止，最后一个 lease 释放后 transport 断开。
5. 快速关闭 creating 阶段终端，不出现迟到 terminal。
6. React StrictMode 下重复 effect 不产生重复后端 session。
7. 编辑 profile host 后，重新打开 Workspace 不复用旧 endpoint。

### UI / i18n

1. `zh-CN` / `en-US` 主界面、Git、Ports、错误提示切换完整。
2. Light / Dark / System 和多套 color theme 可读。
3. 800x600 窗口无重叠。
4. 所有图标按钮有 tooltip / aria-label。
5. 删除与 discard 均有确认。

## 4. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 共享 SSH stale handle | 用户看到假连接 | acquire 检查 `is_closed`；forward supervisor 周期检查 |
| 旧 attempt 覆盖新 session | 状态串线 / 泄漏 | per-session open generation |
| 并发 SFTP ensure | 重复 channel / 连接 | 同 sessionId in-flight Promise |
| 远程 Git quoting | 注入或路径错误 | 每个 argument 单独 POSIX quote；单元测试 |
| Git Graph 历史过大 | UI 卡顿 | 分页 200 / 上限 500；重算当前页 |
| 端口转发残留 relay | 端口关闭后仍可连接 | JoinSet + `shutdown().await` |
| 非 loopback bind | 服务暴露局域网 | 后端硬拒绝 |
| 大文件编辑 | 内存过高 | 2MB 编辑上限，提示用户 |
| 本地写中断 | 文件损坏 | atomic temp + rename |
| 网络认证卡死 | 前端假死 | `GIT_TERMINAL_PROMPT=0` + terminal fallback |

## 5. 后续优先级

### P0：稳定性

- 三平台手动验收矩阵。
- 远程断网后的 Workspace 状态刷新与一键重连体验。
- Git Graph 更完整的虚拟化。

### P1：编辑体验

- Tree-sitter 可选高亮 PoC（不引入 LSP / 插件）。
- 文件保存冲突检测。
- Workspace 文本搜索 / 快速打开。
- 终端 tab 持久化偏好。

### P2：SSH 增强

- SSH Agent。
- ProxyJump。
- remote forward（`-R`）。
- dynamic / SOCKS forward（`-D`）。
- 目录同步。

所有 P1/P2 功能都必须保持轻量边界：不引入 LSP、调试器、任务系统或插件系统。
