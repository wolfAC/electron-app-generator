# Electronify

Electronify is a production-ready Electron wrapper that converts any existing web application's production build folder into a desktop application.

## Features

- 🚀 **Framework Agnostic**: Works with Next.js, React, Vite, Vue, Angular, or any static SPA.
- 📦 **Build Folder Wrapper**: Packages your existing `dist`, `build`, or `out` folders.
- 🔑 **IndexedDB Support**: Uses a custom `app://local` protocol to ensure IndexedDB, Service Workers, and offline-first apps work correctly.
- 🛡️ **Secure by Default**: Implements `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
- 🖥️ **Desktop API**: Exposes a stable bridge for notifications, file system access, and secure storage.
- 🔄 **Auto Updater**: Pluggable architecture with support for GitHub, Custom HTTP, and more.
- 🎨 **Asset Management**: Handles icons, tray images, and splash screens.
- 🛠️ **CLI Tooling**: Simple commands for validation, building, packaging, and publishing.

## Installation

```bash
npm install -g electronify
```

## Usage

1. Create an `electronify/` folder in your project root.
2. Add a `config.json` and assets.

### Example Configuration

```json
{
  "name": "My App",
  "appId": "com.company.myapp",
  "version": "1.0.0",
  "buildFolder": "./build",
  "window": {
    "width": 1400,
    "height": 900
  },
  "features": {
    "tray": true,
    "autoUpdater": true
  },
  "updater": {
    "provider": "github",
    "url": "https://github.com/company/myapp/releases"
  }
}
```

### CLI Commands

- `electronify validate`: Checks if your config and assets are correct.
- `electronify build`: Generates the Electron package and builds the installers.
- `electronify package`: Packages the app without installers.
- `electronify publish`: Uploads artifacts to the configured provider.

## Project Structure

```text
your-project/
├── build/              # Your web app production build
└── electronify/        # Electronify configuration
    ├── config.json     # App settings
    └── assets/         # Icons and images
        ├── logo.png
        ├── icon.ico
        ├── tray.png
        └── splash.png
```

## Desktop API Reference

The following API is available on `window.desktop`:

- `notify({ title, body })`: Show a native notification.
- `openFile()`: Open a file dialog.
- `openFolder()`: Open a folder dialog.
- `saveFile({ defaultName })`: Open a save file dialog.
- `getVersion()`: Returns the current app version.
- `checkForUpdates()`: Triggers the auto-update check.
- `secureStore.set(key, value)`: Securely store a value.
- `secureStore.get(key)`: Retrieve a securely stored value.
- `secureStore.delete(key)`: Remove a securely stored value.
