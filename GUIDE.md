# Electronify — Step-by-Step Usage Guide

Electronify converts a static web app build (Next.js, React, Vite, etc.) into a standalone desktop application using Electron. This guide walks you through every step from installation to publishing.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Project Structure Setup](#3-project-structure-setup)
4. [Configure `electronify/config.json`](#4-configure-electronifyconfigjson)
5. [Prepare Your Assets](#5-prepare-your-assets)
6. [Build Your Web App](#6-build-your-web-app)
7. [Validate the Project](#7-validate-the-project)
8. [Build the Desktop App](#8-build-the-desktop-app)
9. [Package Without Installer](#9-package-without-installer)
10. [Publish Release Artifacts](#10-publish-release-artifacts)
11. [Using the Desktop API in Your Web App](#11-using-the-desktop-api-in-your-web-app)
12. [Auto-Updater](#12-auto-updater)
13. [Plugin System](#13-plugin-system)
14. [Complete Config Reference](#14-complete-config-reference)
15. [Output Directory Reference](#15-output-directory-reference)
16. [Common Errors & Fixes](#16-common-errors--fixes)

---

## 1. Prerequisites

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| Node.js | 18+ | Required by Electron |
| pnpm | 8+ | Package manager used by this tool |
| A static web build | — | The `build/` or `out/` folder from your frontend |

Install pnpm if you don't have it:

```bash
npm install -g pnpm
```

---

## 2. Installation

### Option A — Use from the repo (development)

```bash
git clone <repo-url>
cd electron-app-generator
pnpm install
pnpm build          # compiles TypeScript → dist/
```

Link the CLI globally so you can run `electronify` from any project:

```bash
pnpm link --global
```

### Option B — Install as a package (when published to npm)

```bash
pnpm add -g electronify
```

Verify the install:

```bash
electronify --version
# 1.0.0
```

---

## 3. Project Structure Setup

Navigate to your web project's root directory (where your `package.json` lives). Create the `electronify/` directory with the following layout:

```
your-web-project/
├── build/                      ← your web app's production build output
├── electronify/
│   ├── config.json             ← required: Electronify configuration
│   └── assets/
│       ├── logo.png            ← required: app icon (512×512 PNG recommended)
│       ├── icon.ico            ← optional: Windows taskbar icon
│       ├── tray.png            ← optional: system tray icon (16×16 or 32×32 PNG)
│       └── splash.png          ← optional: splash/loading screen image
└── package.json
```

Create the directories:

```bash
mkdir -p electronify/assets
```

---

## 4. Configure `electronify/config.json`

Create `electronify/config.json` with at minimum the three required fields:

```json
{
  "name": "My App",
  "appId": "com.mycompany.myapp",
  "buildFolder": "build"
}
```

### Minimal config (required fields only)

```json
{
  "name": "My App",
  "appId": "com.mycompany.myapp",
  "buildFolder": "build"
}
```

### Full config with all options

```json
{
  "name": "My App",
  "appId": "com.mycompany.myapp",
  "version": "1.0.0",
  "author": {
    "name": "Jane Doe",
    "email": "jane@mycompany.com"
  },
  "homepage": "https://myapp.com",
  "buildFolder": "build",
  "window": {
    "width": 1400,
    "height": 900,
    "minWidth": 1000,
    "minHeight": 700
  },
  "features": {
    "tray": false,
    "notifications": true,
    "dragDrop": true,
    "singleInstance": true,
    "autoUpdater": true
  },
  "updater": {
    "provider": "github",
    "url": "https://updates.myapp.com"
  },
  "linux": {
    "targets": ["AppImage", "deb"]
  },
  "plugins": []
}
```

See [Section 14](#14-complete-config-reference) for a full description of every field.

---

## 5. Prepare Your Assets

### logo.png (required)

This is the main application icon used by electron-builder across all platforms.

- Format: PNG
- Recommended size: **512×512 px** (electron-builder auto-generates smaller sizes)
- Path: `electronify/assets/logo.png`

### icon.ico (optional — Windows)

Used for the Windows taskbar and executable icon.

- Format: ICO (multi-size, 16/32/48/256 recommended)
- Path: `electronify/assets/icon.ico`

### tray.png (optional — system tray)

Only needed when `features.tray` is `true`.

- Format: PNG
- Recommended size: **32×32 px** (template expects this in `electronify/assets/tray.png`)
- Path: `electronify/assets/tray.png`

### splash.png (optional)

Reserved for a custom splash screen. Not currently wired in the template, but validated as optional.

- Path: `electronify/assets/splash.png`

---

## 6. Build Your Web App

Run your frontend's production build before using Electronify. The output folder must match the `buildFolder` value in your config.

**Next.js (static export):**
```bash
# next.config.js must have: output: 'export'
pnpm build        # produces out/
# set "buildFolder": "out" in config.json
```

**Vite:**
```bash
pnpm build        # produces dist/
# set "buildFolder": "dist" in config.json
```

**Create React App:**
```bash
pnpm build        # produces build/
# set "buildFolder": "build" in config.json (this is the default)
```

The build folder must contain `index.html` at its root.

---

## 7. Validate the Project

Before building, run the validator to catch missing files or config errors early:

```bash
electronify validate
```

**What it checks:**
- `electronify/` directory exists
- `electronify/config.json` is present and valid
- `buildFolder` path exists and is a directory
- `electronify/assets/` directory exists
- `logo.png` is present (critical — build will fail without it)
- `icon.ico`, `tray.png`, `splash.png` are present (optional — warnings only)

**Success output:**
```
✅ Project is valid!
```

**Failure example:**
```
❌ Validation failed: Critical asset missing: logo.png
```

---

## 8. Build the Desktop App

This is the main command. It assembles the Electron app, then runs `electron-builder` to produce platform-specific installers.

```bash
electronify build
```

### What happens internally

1. Validates the project (same as `validate`)
2. Loads any plugins listed in `config.plugins`
3. Runs `preBuild` plugin hooks
4. Cleans and creates `dist_electron/app/`
5. Copies your `buildFolder` content into `dist_electron/app/web/`
6. Copies `electronify/assets/` into `dist_electron/app/assets/`
7. Generates `main.js`, `preload.js`, and `updater.js` from templates
8. Writes a `package.json` for the Electron app
9. Runs `electron-builder` → outputs installers to `releases/`
10. Runs `postBuild` plugin hooks

### Output files (in `releases/`)

| Platform | File |
|----------|------|
| Windows | `My App Setup 1.0.0.exe` (NSIS installer) |
| macOS | `My App-1.0.0.dmg` |
| Linux | `My App-1.0.0.AppImage`, `my-app_1.0.0_amd64.deb` |

**Success output:**
```
🚀 Starting build for My App...
📦 Electron app assembled at dist_electron/app
🛠️  Building installer with electron-builder...
✅ Installer built successfully in releases/
✅ Build successful!
```

### Linux package targets

Control which Linux formats are produced via `linux.targets` in config:

```json
"linux": {
  "targets": ["AppImage", "deb", "rpm", "snap", "pacman", "flatpak"]
}
```

Default is `["AppImage", "deb"]`.

---

## 9. Package Without Installer

Creates an unpacked, runnable app directory without producing an installer. Useful for testing the app before distribution.

```bash
electronify package
```

**Output:** `releases/unpacked/` — a directory you can run directly with Electron.

To run the unpacked app (requires Electron installed locally):

```bash
cd releases/unpacked/linux-unpacked   # or win-unpacked / mac
./my-app                              # run the executable
```

---

## 10. Publish Release Artifacts

Uploads the files in `releases/` to a remote provider. Run `build` first.

```bash
electronify publish
```

### Supported providers

Set `updater.provider` in `config.json`:

| Provider | Value | Notes |
|----------|-------|-------|
| GitHub Releases | `"github"` | Uses `gh` CLI or Octokit |
| Custom HTTP | `"custom"` | POSTs to `updater.url` |

**GitHub example config:**
```json
"updater": {
  "provider": "github",
  "url": "https://github.com/myorg/myapp"
}
```

**Custom HTTP example config:**
```json
"updater": {
  "provider": "custom",
  "url": "https://releases.myapp.com/upload"
}
```

---

## 11. Using the Desktop API in Your Web App

The generated app exposes a `window.desktop` API in the renderer process via the preload script. You can call these from your web app's JavaScript/TypeScript without any extra setup.

### Check if running inside Electron

```js
const isDesktop = typeof window.desktop !== 'undefined';
```

### Send a native notification

```js
await window.desktop.notify({ title: 'Hello', body: 'From the desktop!' });
```

### Get the app version

```js
const version = await window.desktop.getVersion();
console.log(version); // "1.0.0"
```

### Open a file picker

```js
const filePaths = await window.desktop.openFile();
if (filePaths) {
  console.log('Selected:', filePaths);
}
```

### Open a folder picker

```js
const folderPaths = await window.desktop.openFolder();
```

### Save a file dialog

```js
const savePath = await window.desktop.saveFile({ defaultName: 'export.csv' });
if (savePath) {
  // savePath is the user-chosen destination path (string)
}
```

### Secure key-value store (encrypted on disk)

```js
// Store a value (encrypted with OS keychain)
await window.desktop.secureStore.set('apiKey', 'my-secret-value');

// Read it back
const value = await window.desktop.secureStore.get('apiKey');

// Delete it
await window.desktop.secureStore.delete('apiKey');
```

### Check for updates

```js
const result = await window.desktop.checkForUpdates();
console.log(result.status);
```

### TypeScript types (add to your web project)

```ts
interface DesktopAPI {
  notify(opts: { title: string; body: string }): Promise<void>;
  getVersion(): Promise<string>;
  openFile(): Promise<string[] | null>;
  openFolder(): Promise<string[] | null>;
  saveFile(opts: { defaultName: string }): Promise<string | null>;
  secureStore: {
    set(key: string, value: string): Promise<{ success: boolean }>;
    get(key: string): Promise<string | null>;
    delete(key: string): Promise<{ success: boolean }>;
  };
  checkForUpdates(): Promise<{ status: string; result?: unknown }>;
}

declare global {
  interface Window {
    desktop?: DesktopAPI;
  }
}
```

---

## 12. Auto-Updater

Set `features.autoUpdater: true` and configure the `updater` block.

```json
"features": {
  "autoUpdater": true
},
"updater": {
  "provider": "github",
  "url": "https://github.com/myorg/myapp"
}
```

The generated `updater.js` uses a provider-based pattern. The built-in providers are:

- **`GitHubProvider`** — polls GitHub Releases for new versions
- **`CustomHTTPProvider`** — polls a custom endpoint

### Adding a custom provider (advanced)

In `src/templates/electron/updater.js.template`, extend `UpdateProvider`:

```js
class MyProvider extends UpdateProvider {
  async getLatest() { /* fetch version from your backend */ }
  async check() { /* compare with current version */ }
  async download() { /* download the update file */ }
}

const PROVIDERS = {
  // ...existing providers
  myprovider: MyProvider,
};
```

Then set `"updater": { "provider": "myprovider" }` in config.

---

## 13. Plugin System

Plugins let you run custom code at key points in the build and publish lifecycle without modifying the generator source.

### Available hooks

| Hook | When it runs |
|------|-------------|
| `preBuild` | Before assembling the Electron app |
| `postBuild` | After `electron-builder` finishes |
| `prePublish` | Before uploading artifacts |
| `postPublish` | After all artifacts are uploaded |

### Create a plugin

Create a file in `src/plugins/my-plugin.js`:

```js
export default {
  // Called once when the plugin loads
  init(config) {
    console.log('my-plugin initialized for', config.name);
  },

  // Runs before build starts
  async preBuild({ config, appDir }) {
    console.log('About to build into', appDir);
  },

  // Runs after build completes
  async postBuild({ config, outputDir }) {
    console.log('Build complete. Output at', outputDir);
  },

  // Runs before publishing
  async prePublish({ config, releaseDir, files }) {
    console.log('About to publish', files.length, 'files from', releaseDir);
  },

  // Runs after publishing
  async postPublish({ config, releaseDir, files }) {
    console.log('Published successfully!');
  },
};
```

### Register the plugin

Add the plugin filename (without `.js`) to `config.json`:

```json
{
  "plugins": ["my-plugin"]
}
```

Electronify looks for `src/plugins/<name>.js` relative to the working directory.

---

## 14. Complete Config Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Display name of the app |
| `appId` | string | Yes | — | Reverse-domain ID, e.g. `com.company.app` |
| `version` | string | No | `"1.0.0"` | Semver version, e.g. `"2.1.0"` |
| `author.name` | string | No | `"Electronify User"` | Author display name |
| `author.email` | string | No | `"admin@example.com"` | Author email |
| `homepage` | string (URL) | No | `"https://example.com"` | Project website |
| `buildFolder` | string | No | `"./build"` | Path to your web app's build output |
| `window.width` | number | No | `1400` | Initial window width (px) |
| `window.height` | number | No | `900` | Initial window height (px) |
| `window.minWidth` | number | No | `1000` | Minimum window width (px) |
| `window.minHeight` | number | No | `700` | Minimum window height (px) |
| `features.tray` | boolean | No | `false` | Enable system tray icon |
| `features.notifications` | boolean | No | `true` | Enable native notifications |
| `features.dragDrop` | boolean | No | `true` | Enable drag-and-drop |
| `features.singleInstance` | boolean | No | `true` | Prevent multiple app instances |
| `features.autoUpdater` | boolean | No | `true` | Enable auto-update check |
| `updater.provider` | string | No | `"custom"` | One of: `custom`, `github`, `firebase`, `cloudflare`, `s3` |
| `updater.url` | string (URL) | No | `"https://updates.example.com"` | Update server or GitHub repo URL |
| `linux.targets` | string[] | No | `["AppImage","deb"]` | Linux package formats to build |
| `plugins` | string[] | No | `[]` | Plugin filenames to load from `src/plugins/` |

---

## 15. Output Directory Reference

After running commands, these directories are created in your project root:

```
your-web-project/
├── dist_electron/
│   └── app/                    ← assembled Electron app source
│       ├── web/                ← your web build (served via app://local/)
│       ├── assets/             ← copied from electronify/assets/
│       ├── main.js             ← generated Electron main process
│       ├── preload.js          ← generated preload (contextBridge)
│       ├── updater.js          ← generated auto-updater
│       └── package.json        ← generated Electron package.json
└── releases/
    ├── My App Setup 1.0.0.exe  ← Windows installer (after build)
    ├── My App-1.0.0.dmg        ← macOS disk image (after build)
    ├── My App-1.0.0.AppImage   ← Linux AppImage (after build)
    ├── my-app_1.0.0_amd64.deb  ← Debian package (after build)
    └── unpacked/               ← unpacked app directory (after package)
```

---

## 16. Common Errors & Fixes

### `Missing "electronify/" directory in project root`

Run `electronify` commands from your project root (where `package.json` lives), not from inside `electronify/`.

### `Configuration file not found`

Ensure `electronify/config.json` exists. Check the path is exactly `electronify/config.json`.

### `Critical asset missing: logo.png`

Add a PNG image at `electronify/assets/logo.png`. Minimum 256×256 px; 512×512 px recommended.

### `Build folder not found at: build`

Either your web app hasn't been built yet (`pnpm build` in your web project), or `buildFolder` in config.json points to the wrong path. Common values: `"build"`, `"dist"`, `"out"`, `".next"`.

### `Invalid configuration: version: Version must be in semver format`

`version` must follow `major.minor.patch` format: `"1.0.0"` not `"1.0"` or `"v1.0.0"`.

### Electron Builder fails on Linux without system dependencies

Install required system deps:

```bash
# Debian/Ubuntu
sudo apt-get install -y rpm fakeroot dpkg
```

### `No releases directory found. Run build first`

Run `electronify build` before `electronify publish`.

### App opens a blank screen

Your web app likely uses `BrowserRouter` with absolute paths. Make sure it uses hash-based routing (`HashRouter`) or relative paths, since it is served via the `app://local/` custom protocol, not a real web server.

---

## Quick Reference — All CLI Commands

```bash
electronify validate   # Check config and assets are correct
electronify build      # Build installers in releases/
electronify package    # Build unpacked app in releases/unpacked/
electronify publish    # Upload releases/ artifacts to configured provider
electronify --version  # Print version
electronify --help     # Show all commands
```
