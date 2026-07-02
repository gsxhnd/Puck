# AGENTS.md

Puck is a Tauri v2 desktop terminal / SSH / SFTP workbench. Frontend: React 19 + TypeScript + Vite in `src/`. Backend: Rust in `src-tauri/src/`.

## Commands

- `npm run dev` — frontend only (Vite, fixed port 1420, `strictPort`). Does NOT run the Rust backend, so IPC calls fail (`isTauri()` is false → localStorage fallback).
- `npm run tauri dev` — full desktop app; this is what you usually want.
- `npm run build` — `tsc && vite build`. **This is the only typecheck gate** (there is no separate `typecheck`/`lint` script).
- `cd src-tauri && cargo check` — verify Rust.
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings` — currently FAILS (unused/dead code). Expect noise; don't assume a clean baseline.

There are **no automated tests** (no `*.test.ts`, no Rust `#[test]`). Verification = `npm run build` + `cargo check` + manual runtime check. No ESLint/Prettier/rustfmt/clippy config files exist.

## Architecture gotchas an agent will miss

**Single bundle, multiple windows via query param.** `main`, `settings`, `connections`, and `editor` windows all load the same React bundle; the mode is chosen by `?window=` in `src/lib/app-window.ts` (`getAppWindowMode()`), branched in `src/App.tsx`. Rust opens aux windows via `*_window.rs` commands. Cross-window state stays in sync through the `puck:config-changed` event and the `*-sync` providers under `src/layout/providers/`.

**Config persistence has a whitelist that silently drops unknown sections.** Flow: Zustand `persist` → `puckConfigStorage` (`src/lib/puck-config-storage.ts`) → IPC `set_puck_config_section` → `src-tauri/src/config.rs`. `config.rs` only accepts sections listed in `UI_SECTIONS`; anything else is a **silent no-op** (this is the root cause of the known `hosts_layout` bug). To add a new persisted store you MUST update `config.rs` in four places: a `SECTION_*` const, a field on `PuckConfigFile`, the `UI_SECTIONS` array, and both the `section_value`/`set_section_value` match arms — plus add the key to `PUCK_CONFIG_KEYS` in `puck-config-storage.ts`.

**Every Rust `#[tauri::command]` must be registered** in the `generate_handler![...]` list in `src-tauri/src/lib.rs`, or the frontend `invoke` fails at runtime.

**IPC error contract.** Rust returns errors as JSON `PuckError` (`src-tauri/src/error.rs`, built via `puck_err()`). On the frontend, parse with `parsePuckError()` / `isHostKeyError()` (`src/lib/puck-error.ts`) — do not show raw error strings. All `invoke` wrappers live in `src/lib/tauri-*.ts`; add new IPC calls there, not inline.

**i18n.** Namespaces are registered in `src/i18n/index.ts` and every key must exist in BOTH `src/i18n/locales/zh-CN/*` and `en-US/*`. Default language is `zh-CN`. Adding a new namespace requires editing the imports, `resources`, and `ns` array in `index.ts`.

## Conventions

- Import alias `@/` → `src/` (configured in both `tsconfig.json` and `vite.config.ts`).
- **Tailwind v4, no config file** — theme lives in `src/App.css` (`@import "tailwindcss"` + `@theme`). There is no `tailwind.config.js`.
- UI is shadcn/ui (`base-nova` style, see `components.json`) built on `@base-ui/react` primitives + `lucide-react`. Prefer existing `src/components/ui/*` over raw HTML controls.
- Source files use bilingual doc comments: an English summary line, then a Chinese explanation. Match this when adding module-level docs.
- Rust `edition = "2024"` — requires a recent toolchain.

## Data & platform

- Config: `~/.config/puck/config.toml`; known hosts: `~/.config/puck/known_hosts.json` (this path is hardcoded on **all** platforms, incl. Windows/macOS).
- Connections: `~/.config/puck/connections.json`.
- Secrets (passwords, key passphrases) go to the OS keychain via `keyring`, keyed `puck.connection.<connectionId>.<field>` — never written to `config.toml`.
- macOS-only: native menu (`macos_menu.rs`), window vibrancy, `macOSPrivateApi`. Shortcuts are re-implemented in the frontend so they work cross-platform.
- Not implemented despite existing UI/types: FTP/FTPS backend, SSH Agent, ProxyJump, port forwarding, transfer cancel/pause. `open_path_in_app` is macOS-only.

## Reference material

Repo-local skills exist under `.agents/skills/` (`tauri-v2`, `shadcn`, `rust-best-practices`, `vercel-react-best-practices`) and load automatically via the skill tool. Deeper design docs: `docs/` and `README.md`.
