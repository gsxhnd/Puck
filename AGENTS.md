# AGENTS.md

Puck is a lightweight Tauri v2 local/remote code workbench: Monaco editing, local and SSH terminals, workspace files, Git, Git Graph, and SSH local port forwarding. Frontend: React 19 + TypeScript + Vite in `src/`. Backend: Rust in `src-tauri/src/`.

Puck intentionally has **no LSP, debugger, task system, or plugin system**. Do not add language-service workers, plugin loaders, or IDE-style extensibility hooks.

## Commands

- `npm run dev` — frontend only (Vite, fixed port 1420, `strictPort`). IPC calls fail outside Tauri (`isTauri()` is false → localStorage fallback).
- `npm run tauri dev` — full desktop app; use this for runtime verification.
- `npm run build` — `tsc && vite build`. **This is the only TypeScript typecheck/build gate** (there is no separate `typecheck`/`lint` script).
- `cd src-tauri && cargo check` — Rust compile check.
- `cd src-tauri && cargo test` — Rust unit tests. Git parsing, graph parsing, remote Git quoting, atomic writes, and UTF-8 stream decoding are covered.
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` — currently clean; keep it clean.

There are no frontend test-runner scripts or ESLint/Prettier/rustfmt config files. Verification is `npm run build` + `cargo check` + `cargo test` + `cargo clippy -D warnings` + manual desktop checks.

## Architecture gotchas an agent will miss

**Single bundle, multiple windows via query param.** `main`, `settings`, and `connections` windows load the same React bundle; the mode is chosen by `?window=` in `src/lib/app-window.ts` and branched in `src/App.tsx`. Rust opens aux windows via `*_window.rs` commands. Cross-window state synchronizes through `puck:config-changed` and providers under `src/layout/providers/`.

**Workspace is the center of the main window.** `src/stores/workspace-store.ts` owns the active local/remote workspace, recents, sidebar view, and terminal visibility. Files, Git, editor tabs, terminal tabs, and forwards are scoped by `workspaceId`. Terminals may `cd`, but terminal cwd does not redefine the workspace root.

**Editors and terminals are equal, independent areas.** The center is a vertical resizable group: `WorkbenchTabArea` owns editor/Diff/Git Graph tabs; `WorkspaceTerminal` owns terminal tabs. Closing every terminal does not close the app or the workspace.

**Shared SSH has leases and open generations.** `src-tauri/src/ssh.rs` maps a connection profile to one authenticated russh handle. Terminal, SFTP, remote Git, and each port forward acquire independent owner IDs. The active remote workspace holds a base lease through `RemoteWorkspaceConnection`. Only the final owner disconnects. SSH opens use per-session generations so a stale StrictMode/late handshake cannot register after close. Do not disconnect the shared handle from a terminal or SFTP worker.

**Config persistence has a whitelist that rejects unknown sections.** Flow: Zustand `persist` → `puckConfigStorage` (`src/lib/puck-config-storage.ts`) → IPC `set_puck_config_section` → `src-tauri/src/config.rs`. To add a persisted store, update `config.rs` in four places (`SECTION_*`, `PuckConfigFile` field, `UI_SECTIONS`, both match arms) and add the key to `PUCK_CONFIG_KEYS`.

**Every Rust `#[tauri::command]` must be registered** in `generate_handler![...]` in `src-tauri/src/lib.rs`, or frontend `invoke` fails at runtime.

**IPC error contract.** Rust returns JSON `PuckError` via `into_payload()` / `puck_err()`. On the frontend, use `parsePuckError()` / `isHostKeyError()` (`src/lib/puck-error.ts`), never raw strings. All `invoke` wrappers live in `src/lib/tauri-*.ts`; add new IPC calls there, not inline in components.

**Git uses CLI adapters, not git2.** Local commands are in `src-tauri/src/git.rs`; remote commands are in `src-tauri/src/remote_git.rs` and execute over the shared SSH connection with POSIX-quoted arguments and `GIT_TERMINAL_PROMPT=0`. Git Graph data comes from `git log --all --topo-order`; lane layout is pure TypeScript in `src/lib/git-graph-layout.ts`.

**Port forwarding is local-forward only.** `src-tauri/src/port_forward.rs` implements `ssh -L`, binds loopback only, gives each accepted TCP socket a direct-tcpip channel, and shuts down listener + all relays on stop. Remote `-R` and dynamic `-D` are intentionally absent.

**i18n.** Namespaces are registered in `src/i18n/index.ts`; every key must exist in BOTH `src/i18n/locales/zh-CN/*` and `en-US/*`. Default language is `zh-CN`.

## Conventions

- Import alias `@/` → `src/` (configured in `tsconfig.json` and `vite.config.ts`).
- Tailwind v4 has no config file; theme tokens live in `src/App.css` (`@import "tailwindcss"` + `@theme`).
- UI is shadcn/ui (`base-nova`, see `components.json`) on `@base-ui/react` + `lucide-react`. Prefer existing `src/components/ui/*`.
- Source files use bilingual module docs: an English summary line, then a Chinese explanation. Match this style.
- Rust `edition = "2024"`; let-chains are available and used by clippy-clean code.

## Data & platform

- Config: `~/.config/puck/config.toml` with sections `app_settings`, `session_privileges`, `shell_layout`, and `workspaces`; known hosts: `~/.config/puck/known_hosts.json` (hardcoded path on all platforms).
- Connections: `~/.config/puck/connections.json`. Only `ssh` and `sftp` profiles are accepted; legacy FTP/FTPS/RDP/VNC rows are filtered during rehydration.
- Secrets go to the OS keychain via `keyring`, keyed `puck.connection.<connectionId>.<field>` — never to `config.toml`.
- macOS-only: native menu (`macos_menu.rs`), vibrancy, `macOSPrivateApi`. Shortcuts are re-implemented in the frontend for cross-platform use. `open_path_in_app` is macOS-only.
- Runtime terminals, editor tabs, Git Graph pagination, and port forwards are not persisted.

## Deliberately not implemented

Tree-sitter (future optional highlight enhancement), SSH Agent, ProxyJump, remote/dynamic forwarding, SFTP upload/download transfer queue, user-custom shortcuts, directory sync, and any LSP/plugin mechanism. FTP/FTPS and RDP/VNC have been removed rather than left as placeholders.

## Reference material

Repo-local skills exist under `.agents/skills/` (`tauri-v2`, `shadcn`, `rust-best-practices`, `vercel-react-best-practices`). Design docs live in `docs/` and `REFACTOR_PLAN.md`.
