# Making Your Web App Electron-Ready (Electronify)

These guides explain **what you must change in your web app** so its production build
runs correctly inside the desktop app that Electronify generates. They are derived from
the actual runtime behavior of the generated app, not generic Electron advice.

| Framework | Guide |
|-----------|-------|
| Next.js | [nextjs.md](./nextjs.md) |
| React (CRA / Vite) | [react.md](./react.md) |
| Vue (Vite / Vue CLI) | [vue.md](./vue.md) |
| Angular | [angular.md](./angular.md) |

---

## How the generated app serves your build (read this first)

Electronify copies your `buildFolder` into the app under `web/` and serves it through a
**custom protocol** registered in `main.js`:

```
mainWindow.loadURL('app://local/');   // the app always boots at the root
```

The protocol handler (`src/templates/electron/main.js.template`) does this for every request:

1. Takes the URL pathname and maps it to `web/<pathname>`.
2. `/` (or empty) → `web/index.html`.
3. Resolves the path in this order and serves the first match that is a real file:
   **(a)** exact file (`/foo.js` → `web/foo.js`), **(b)** directory index
   (`/about` or `/about/` → `web/about/index.html`), **(c)** clean-URL `.html`
   (`/about` → `web/about.html`).
4. If nothing matched **and** the request is a document navigation (the browser sent
   `Accept: text/html`, or the path has no file extension) → **fall back to the root
   `web/index.html`** (the SPA fallback). Anything else (a real asset URL that 404s)
   returns an honest **HTTP 404**.

It is registered as a **standard, secure scheme** with `fetch`, CORS, and streaming
enabled, so `window.location.origin === 'app://local'`, and IndexedDB, LocalForage,
Service Workers, and the Fetch API all behave like they do on a normal web origin.

### The five rules that fall out of this

These apply to **every** framework. The per-framework guides just show the exact config.

1. **Your build must produce `index.html` at the root of the build folder.**
   This is the entry point. If it isn't there, you get a blank/404 app.

2. **It must be a fully static build — there is no server.**
   No SSR, no API routes, no server-side rendering at request time, no on-the-fly
   image optimization. Everything ships as static `.html`, `.js`, `.css`, and assets.

3. **A wrong asset URL now returns a real 404.**
   The handler only falls back to `index.html` for document navigations, so a missing
   `app.js`/`styles.css` returns a proper `404` instead of HTML. If you're on an older
   build of the generator you may instead see:

   ```
   Uncaught SyntaxError: Unexpected token '<'
   ```

   Either way (`404` or that error) the cause is the same — **an asset URL that doesn't
   resolve under the web root.** Fix the base/asset path.

4. **Deep links and hard reloads to sub-routes work.**
   - **Multi-page / static-export apps** (Next.js export, Nuxt generate): a hard
     navigation to `app://local/about` resolves to `web/about/index.html` or
     `web/about.html` via steps 3b/3c above and renders the correct page.
   - **Single-page apps** (one `index.html` + a client router): a route like
     `app://local/settings` has no matching file, so the navigation falls back to the
     root `index.html` **with the URL preserved**, and your client router renders the
     route. History mode (`BrowserRouter`, `createWebHistory`, `PathLocationStrategy`)
     therefore works on reload — hash routing is no longer required, though it remains a
     perfectly safe choice.

5. **Use absolute root paths (`/assets/...`), not the `file://` relative-path hack.**
   Because this is a real scheme with an origin, `/assets/app.js` correctly resolves to
   `web/assets/app.js`. Relative bases (`./`) appear to work at the root but **break the
   moment your client router is on a deep path** and a lazy chunk is requested relative
   to that path. Prefer an absolute base.

### Things that need extra thought

- **Origin is `app://local`, not `https://...`.** Calls to your backend are cross-origin
  → the server needs permissive CORS. OAuth/redirect flows that expect an `http(s)`
  redirect URI generally won't work unmodified.
- **No Node.js in the page.** `sandbox: true`, `contextIsolation: true`,
  `nodeIntegration: false`. You cannot use `require`, `process`, `fs`, `__dirname` in
  renderer code. Native capabilities are exposed only through `window.desktop`
  (notifications, file dialogs, secure store, updates) — see `GUIDE.md` §11.
- **Detecting Electron:** feature-detect `window.desktop` (e.g.
  `const isDesktop = typeof window !== 'undefined' && !!window.desktop;`).

---

## The complete feature surface

There are two kinds of features. **Runtime APIs** are called from your web code via
`window.desktop`. **Config features** are toggled in `electronify/config.json` and need no
code. Each framework guide wires the runtime API into an idiomatic wrapper; this is the
canonical list.

### Runtime API — every `window.desktop` method

All methods are async (return Promises). All are safe to call only after confirming
`window.desktop` exists (it's `undefined` in a plain browser).

| Method | Signature | What it does |
|--------|-----------|--------------|
| `notify` | `notify({ title, body }): Promise<void>` | Native OS notification. |
| `getVersion` | `getVersion(): Promise<string>` | App version from `config.json` (e.g. `"1.0.0"`). |
| `openFile` | `openFile(): Promise<string[] \| null>` | Native open dialog (multi-select). `null` if cancelled. |
| `openFolder` | `openFolder(): Promise<string[] \| null>` | Native folder picker. `null` if cancelled. |
| `saveFile` | `saveFile({ defaultName }): Promise<string \| null>` | Native save dialog; returns chosen path. `null` if cancelled. |
| `secureStore.set` | `set(key, value): Promise<{ success }>` | Persist a string, OS-encrypted via `safeStorage`. |
| `secureStore.get` | `get(key): Promise<string \| null>` | Read & decrypt. `null` if absent. |
| `secureStore.delete` | `delete(key): Promise<{ success }>` | Remove a key. |
| `checkForUpdates` | `checkForUpdates(): Promise<{ status, result? }>` | Trigger an update check (no-op if `autoUpdater` is off). |
| `setIcon` | `setIcon(dataUrlPng): Promise<{ success }>` | Replace the taskbar/dock **and** tray icon at runtime (theme tinting). |

Returned paths from `openFile`/`openFolder`/`saveFile` are absolute OS paths — you can't
read/write them directly from the sandboxed renderer; pass them to a plugin or your own
backend, or use them for display. The complete copy-paste snippets per method live in
`GUIDE.md` §11; the framework guides below give you a typed wrapper that exposes all of
them at once.

### Config features — toggled in `config.json`, no code required

```jsonc
"features": {
  "tray": false,          // show a system-tray icon with Show/Hide/Quit menu
  "menuBar": true,        // false = hide the native menu bar entirely
  "notifications": true,  // see note ↓
  "dragDrop": true,       // see note ↓
  "singleInstance": true, // a second launch focuses the existing window
  "autoUpdater": true     // enables checkForUpdates(); see GUIDE.md §12
},
"window": { "width": 1400, "height": 900, "minWidth": 0, "minHeight": 0 }
```

- **`tray`** — when on, the window starts hidden and lives in the tray. Requires
  `electronify/assets/tray.png`.
- **`menuBar`** — `false` removes the application menu (`Menu.setApplicationMenu(null)`)
  and auto-hides the bar.
- **`singleInstance`** / **`autoUpdater`** — enforced in the main process as described.
- **`notifications`** — ⚠️ currently a placeholder: `window.desktop.notify()` works
  regardless of this flag. Don't rely on it to disable notifications.
- **`dragDrop`** — ⚠️ currently a placeholder: there is no main-process handler. Drag &
  drop is implemented entirely in your web app with standard HTML5 `dragover`/`drop`
  events; the flag does not gate it.

`window.*` controls the initial/min/max window size (see the per-framework guides' config
references and `GUIDE.md` §14).

---

## Universal pre-flight checklist

- [ ] Production build emits `index.html` at the build-folder root.
- [ ] Build is fully static (no server runtime required).
- [ ] Asset URLs are absolute-from-root (`/assets/...`) and resolve under the web root.
- [ ] Routing works on reload (history mode is fine; hash routing also fine).
- [ ] No `require`/`process`/Node APIs in renderer code.
- [ ] Backend allows CORS from `app://local` (or requests are proxied).
- [ ] `electronify/config.json` `buildFolder` points at the correct output folder.
- [ ] Verified by loading the build through the protocol, not by `open index.html`.
