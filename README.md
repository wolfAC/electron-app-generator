# Electronify

Electronify is a production-ready Electron wrapper that converts any existing web application's production build folder into a standalone desktop application.

## ✨ Features

- 🚀 **Framework Agnostic**: Works with Next.js, React, Vite, Vue, Angular, or any static SPA.
- 📦 **Build Folder Wrapper**: Packages your existing `dist`, `build`, or `out` folders without needing access to the original source code.
- 🔑 **IndexedDB Support**: Uses a custom `app://local` protocol to ensure IndexedDB, Service Workers, and offline-first apps work correctly (bypassing `file://` restrictions).
- 🛡️ **Secure by Default**: Implements `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
- 🖥️ **Desktop API**: Exposes a stable, secure bridge (`window.desktop`) for notifications, file system access, and secure storage.
- 🔄 **Auto Updater**: Pluggable architecture with support for GitHub, Custom HTTP, and others.
- 🎨 **Asset Management**: Automated handling of icons, tray images, and splash screens.
- 🛠️ **CLI Tooling**: Simple commands for validation, building, packaging, and publishing.

## 🚀 Getting Started

### 1. Prerequisites
Before using Electronify, ensure you have:
- **Node.js LTS** installed.
- A **production build folder** of your web app (e.g., the result of `npm run build`).

### 2. Installation
Install Electronify globally:
```bash
npm install -g electronify
```

### 3. Step-by-Step Implementation

#### Step A: Create the Electronify Folder
In your project root (next to your build folder), create an `electronify` directory and an `assets` subfolder:
```bash
mkdir -p electronify/assets
```

#### Step B: Configure Your Application
Create a `config.json` file inside the `electronify/` folder. 

**Comprehensive Example Configuration:**
```json
{
  "name": "My Awesome App",
  "appId": "com.company.awesomeapp",
  "version": "1.0.0",
  "author": {
    "name": "Jane Doe",
    "email": "jane@company.com"
  },
  "homepage": "https://awesomeapp.com",
  "buildFolder": "./build",
  "window": {
    "width": 1280,
    "height": 800,
    "minWidth": 800,
    "minHeight": 600
  },
  "features": {
    "tray": true,
    "notifications": true,
    "dragDrop": true,
    "singleInstance": true,
    "autoUpdater": true
  },
  "updater": {
    "provider": "github",
    "url": "https://github.com/company/awesomeapp/releases"
  }
}
```

#### Step C: Add Required Assets
Place your icons and images in the `electronify/assets/` folder:
- `logo.png` (Required)
- `icon.ico` (Recommended for Windows)
- `tray.png` (Required if `features.tray` is enabled)
- `splash.png` (Optional)

#### Step D: Build Your Application
Run the build command from your project root:
```bash
electronify build
```
This will:
1. Validate your configuration and assets.
2. Assemble the Electron application in `dist_electron/`.
3. Generate platform-specific installers in the `releases/` folder.

---

## 🛠️ CLI Commands

| Command | Description |
| :--- | :--- |
| `electronify validate` | Validates `config.json` and ensures all required assets are present. |
| `electronify build` | Assembles the app and generates installers (NSIS, DMG, AppImage). |
| `electronify package` | Creates an unpacked, runnable distribution folder in `releases/unpacked`. |
| `electronify publish` | Uploads the built artifacts to the configured release provider. |

## 📂 Project Structure Example

```text
your-project/
├── build/              # Your web app production build (e.g. index.html, assets/)
└── electronify/        # Electronify configuration
    ├── config.json     # App settings and metadata
    └── assets/         # Application branding
        ├── logo.png
        ├── icon.ico
        ├── tray.png
        └── splash.png
```

## 🖥️ Desktop API Reference

Your web app can communicate with the system via the `window.desktop` object:

### Notifications
```javascript
window.desktop.notify({
  title: "Hello!",
  body: "This is a native desktop notification."
});
```

### File System
```javascript
// Open a file selection dialog
const files = await window.desktop.openFile();

// Open a folder selection dialog
const folders = await window.desktop.openFolder();

// Save a file
const savePath = await window.desktop.saveFile({ defaultName: 'document.txt' });
```

### Secure Storage
Stores data encrypted on disk using the OS keychain/credential manager.
```javascript
await window.desktop.secureStore.set('api_key', 'secret-value-123');
const key = await window.desktop.secureStore.get('api_key');
await window.desktop.secureStore.delete('api_key');
```

### Application Info
```javascript
const version = await window.desktop.getVersion();
const updateStatus = await window.desktop.checkForUpdates();
```
