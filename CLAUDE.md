# Electronify Project Guide

## 🎯 Project Goal
Electronify is a production-ready generator that converts a static web application build folder (e.g., from Next.js, React, Vite) into a standalone desktop application using Electron. It focuses on security, stability, and a seamless developer experience.

## 🏗️ Architecture

### Generator Architecture (The Tool)
The tool follows a linear pipeline:
`CLI (commander)` $\rightarrow$ `Validation (zod/fs-extra)` $\rightarrow$ `Assembly (templates)` $\rightarrow$ `Packaging/Building (electron-builder)` $\rightarrow$ `Publishing (providers)`.

- **Core Logic (`src/core/`)**:
    - `config.js`: Zod-based configuration validation.
    - `validator.js`: Verifies the existence of the build folder and required assets.
    - `builder.js`: Orchestrates the assembly of the Electron app and triggers `electron-builder`.
    - `packager.js`: Generates unpacked distributions.
    - `publisher.js`: Handles artifact upload via a provider-based system.
    - `pluginManager.js`: Allows extending the generator via hooks (`preBuild`, `postBuild`, etc.).

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
- **Package Manager**: `pnpm`
- **Validation**: `zod`
- **CLI**: `commander`
- **FS Operations**: `fs-extra`
- **Packaging**: `electron-builder`

### Code Style
- **Modules**: ES Modules (`import/export`) for the generator; CommonJS (`require`) for Electron templates (due to Electron's current requirements).
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
