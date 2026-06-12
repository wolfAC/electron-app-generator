# Electronify Project Guide

## 🎯 Project Goal
Electronify is a production-ready generator that converts a static web application build folder (e.g., from Next.js, React, Vite) into a standalone desktop application using Electron. It focuses on security, stability, and a seamless developer experience.

## 🏗️ Architecture

### Generator Architecture (The Tool)
The tool follows a linear pipeline:
`CLI (commander)` $\rightarrow$ `Validation (zod/fs-extra)` $\rightarrow$ `Assembly (templates)` $\rightarrow$ `Packaging/Building (electron-builder)` $\rightarrow$ `Publishing (providers)`.

- **Core Logic (`src/core/`)**:
    - `config.ts`: Zod-based configuration validation (exports the `ElectronifyConfig` type).
    - `validator.ts`: Verifies the existence of the build folder and required assets.
    - `builder.ts`: Orchestrates the assembly of the Electron app and triggers `electron-builder`.
    - `packager.ts`: Generates unpacked distributions.
    - `publisher.ts`: Handles artifact upload via a provider-based system.
    - `pluginManager.ts`: Allows extending the generator via hooks (`preBuild`, `postBuild`, etc.).

- **Templates (`src/templates/electron/`)**:
    - `main.js.template`: The entry point for the generated app.
    - `preload.js.template`: The secure bridge between the main and renderer processes.
    - `updater.js.template`: Pluggable auto-update logic.

### Generated App Architecture
The resulting application adheres to Electron security best practices:
- **Security**: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- **Communication**: All main-process capabilities are exposed via the `window.desktop` API in the preload script using `ipcRenderer.invoke`.
- **Protocol**: Uses a custom `app://local` protocol instead of `file://` to ensure IndexedDB, LocalForage, and Service Workers function correctly.

## ✨ Key Features & Implementation

### Custom Protocol (`app://local`)
Implemented via `protocol.handle`. It maps `app://local/` requests to the `web/` directory within the app's installation path. This is critical for offline-first apps and IndexedDB support.

### Desktop API (`window.desktop`)
Exposed via `contextBridge`. 
- **Notifications**: Native Electron `Notification`.
- **FileSystem**: Uses `dialog.showOpenDialog` and `dialog.showSaveDialog`.
- **Secure Store**: Uses `electron.safeStorage` to encrypt/decrypt sensitive data stored in `userData/secure_store.json`.

### Auto-Updater
A provider-based pattern (`UpdateProvider` base class). Supports `GitHubProvider` and `CustomHTTPProvider`. New providers should extend `UpdateProvider` and implement `check()`, `download()`, and `getLatest()`.

### Plugin System
The `PluginManager` allows external JS files in `src/plugins` to hook into the build and publish lifecycle.

## 🛠️ Development Guidelines

### Tech Stack
- **Language**: TypeScript (strict mode) for the generator source in `src/`, compiled to `dist/` via `tsc` (`pnpm build`). Templates remain plain JS.
- **Package Manager**: `pnpm`
- **Validation**: `zod`
- **CLI**: `commander`
- **FS Operations**: `fs-extra`
- **Packaging**: `electron-builder`

### Code Style
- **Modules**: ES Modules (`import/export`) for the generator; relative imports use `.js` extensions (NodeNext resolution); CommonJS (`require`) for Electron templates (due to Electron's current requirements).
- **Types**: Shared types live next to their source — `ElectronifyConfig` in `src/core/config.ts` (inferred from `ConfigSchema`), `ElectronifyPlugin`/`HookContext`/`HookName` in `src/core/pluginManager.ts`.
- **Naming**: CamelCase for variables/functions, PascalCase for classes.
- **Error Handling**: Use `try-catch` blocks in the core logic and `electron-log` for the generated app's main process.

### How to Add a New Feature
1. **New Desktop API**:
    - Add the handler in `main.js.template` using `ipcMain.handle`.
    - Add the bridge function in `preload.js.template` using `contextBridge.exposeInMainWorld`.
2. **New Update Provider**:
    - Create a class extending `UpdateProvider` in `updater.js.template`.
    - Register the provider in the `PROVIDERS` map.
3. **New Generator Plugin**:
    - Create a file in `src/plugins/` that implements `init(config)` and desired hooks (e.g., `preBuild`).

## 🚩 Critical Constraints
- **NEVER** use `nodeIntegration: true` or `contextIsolation: false`.
- **NEVER** load the web build via `mainWindow.loadFile('index.html')` as it breaks IndexedDB; always use `app://local/`.
- Ensure all `electron-builder` configurations are flexible and based on the `config.json` provided by the user.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **electron-app-generator** (102 symbols, 141 relationships, 3 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/electron-app-generator/context` | Codebase overview, check index freshness |
| `gitnexus://repo/electron-app-generator/clusters` | All functional areas |
| `gitnexus://repo/electron-app-generator/processes` | All execution flows |
| `gitnexus://repo/electron-app-generator/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
