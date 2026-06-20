# React (Vite / CRA) → Electronify

> Read [README.md](./README.md) first — the five universal rules apply here too.

A plain React SPA is the **best-behaved** target for Electronify: it's already a static
bundle that boots at `/` and routes on the client. Two things matter — the **base path**
and the **router mode**.

---

## 1. Vite (recommended)

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',          // absolute root paths resolve under app://local/  ✅
  build: { outDir: 'dist' },
});
```

> **Do not use `base: './'`.** The common "relative base for Electron" tip is for the
> `file://` protocol. Electronify uses a real `app://local` scheme with an origin, so
> absolute `/assets/...` URLs resolve correctly — and relative URLs **break** when a lazy
> chunk loads while your router is on a deep path. Keep `base: '/'`.

Build → `buildFolder`:

```bash
npm run build      # → dist/
```
```json
"buildFolder": "../my-react-app/dist"
```

## 2. Create React App (CRA)

CRA emits absolute `/static/...` paths by default, which is what you want. **Do not** set
`"homepage": "."` in `package.json` (that switches CRA to relative paths). Leave
`homepage` unset or set it to `"/"`. Output is `build/`:

```json
"buildFolder": "../my-react-app/build"
```

---

## 3. Routing — `BrowserRouter` or `HashRouter` both work

A single-page React app has one `index.html`, so a route like `/settings` has no matching
file. The protocol handler detects the document navigation and falls back to the root
`index.html` **with the URL preserved**, and React Router renders the route from
`window.location`. So `BrowserRouter` works on hard reload and deep links:

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}
```

`HashRouter` (`app://local/#/settings`) is equally fine and keeps routes entirely out of
the protocol handler — use it if you prefer, but it's no longer required.

---

## 4. Native APIs — using every feature

See [README.md → The complete feature surface](./README.md#the-complete-feature-surface)
for the full table. Below is a typed wrapper that exposes **all** of them, plus a hook.

```ts
// src/desktop.ts — typed bridge to window.desktop
export interface DesktopAPI {
  notify(o: { title: string; body: string }): Promise<void>;
  getVersion(): Promise<string>;
  openFile(): Promise<string[] | null>;
  openFolder(): Promise<string[] | null>;
  saveFile(o: { defaultName: string }): Promise<string | null>;
  secureStore: {
    set(key: string, value: string): Promise<{ success: boolean }>;
    get(key: string): Promise<string | null>;
    delete(key: string): Promise<{ success: boolean }>;
  };
  checkForUpdates(): Promise<{ status: string; result?: unknown }>;
  setIcon(dataUrlPng: string): Promise<{ success: boolean; error?: string }>;
}
declare global { interface Window { desktop?: DesktopAPI } }

export const desktop = typeof window !== 'undefined' ? window.desktop ?? null : null;
export const isDesktop = !!desktop;
```

```ts
// src/useDesktop.ts
import { desktop, isDesktop } from './desktop';
export const useDesktop = () => ({ desktop, isDesktop });
```

A component touching **every** capability:

```tsx
import { useDesktop } from './useDesktop';
import { tintIcon } from './tintIcon'; // see §4.1

export function DesktopPanel() {
  const { desktop, isDesktop } = useDesktop();
  if (!isDesktop) return <p>Running in a browser — desktop features hidden.</p>;
  const d = desktop!;

  return (
    <div>
      <button onClick={() => d.notify({ title: 'Hi', body: 'Native notification' })}>Notify</button>
      <button onClick={async () => alert(await d.getVersion())}>Version</button>
      <button onClick={async () => console.log(await d.openFile())}>Open file(s)</button>
      <button onClick={async () => console.log(await d.openFolder())}>Open folder</button>
      <button onClick={async () => {
        const path = await d.saveFile({ defaultName: 'export.csv' });
        if (path) console.log('save to', path); // hand to a plugin/backend
      }}>Save as…</button>
      <button onClick={() => d.secureStore.set('apiKey', 'secret-123')}>Store secret</button>
      <button onClick={async () => alert(await d.secureStore.get('apiKey'))}>Read secret</button>
      <button onClick={() => d.secureStore.delete('apiKey')}>Delete secret</button>
      <button onClick={async () => alert((await d.checkForUpdates()).status)}>Check updates</button>
      <button onClick={async () => d.setIcon(await tintIcon('/logo.png', '#6366f1'))}>Tint icon</button>
    </div>
  );
}
```

There is **no Node** in the renderer — never `require('fs')`. File paths returned by the
dialogs are opaque strings; act on them via a plugin or your backend.

### 4.1 Icon tinting helper

`setIcon` takes a base64 PNG data URL. Generate one on a canvas (no dependencies):

```ts
// src/tintIcon.ts
export async function tintIcon(iconUrl: string, hex: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.crossOrigin = 'anonymous';
    i.onload = () => res(i); i.onerror = rej; i.src = iconUrl;
  });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'multiply';     // 'source-atop' for monochrome icons
  ctx.fillStyle = hex; ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(img, 0, 0);
  return c.toDataURL('image/png');               // use a 256×256+ source for crisp results
}
```

### 4.2 Config features (no code)

`tray`, `menuBar`, `singleInstance`, `autoUpdater`, and window sizing are set in
`electronify/config.json` — see the README feature table. Drag & drop is plain HTML5
(`onDragOver`/`onDrop`) in your components; the `dragDrop` flag does not gate it.

### 4.3 Feature prerequisites

Every `window.desktop` method is usable from the renderer immediately, but some need
setup outside your web code before they work end-to-end.

| Feature | What you need |
|---------|---------------|
| `notify({ title, body })` | Nothing in your web code — uses Electron's main-process `Notification`, not the browser API. No `Notification.requestPermission()` needed. Set a unique `"appId"` in `config.json` so Windows groups toasts correctly under your app. |
| `openFile()` / `openFolder()` / `saveFile()` | Nothing. Returned values are opaque OS path strings. The sandboxed renderer **cannot** read or write files at those paths — pass the path to your backend API or a generator plugin to act on them. |
| `secureStore.set/get/delete` | Nothing on macOS/Windows (`safeStorage` uses the OS keychain). On Linux, falls back to unencrypted storage if no GNOME Keyring / KWallet is running. |
| `checkForUpdates()` | `"autoUpdater": true` in `config.json` **and** a configured update-server URL. Without it the call resolves to `{ status: 'disabled' }`. |
| `setIcon(dataUrlPng)` | A 256×256+ PNG as a base64 data URL. Use the `tintIcon` helper (see §4.1) to generate one at runtime from any image. |
| `fetch` to your backend | Absolute URL via an env var (see §5). The server must send `Access-Control-Allow-Origin: app://local` and handle `OPTIONS` preflight. |

---

## 5. Data & networking

- `localStorage`, `IndexedDB`, and the Cache API all work because `app://local` is a
  secure origin.
- Calls to your API are cross-origin from `app://local` → enable CORS server-side, or
  store secrets via `window.desktop.secureStore` rather than relying on cookies.

**Setting up the API base URL via env:**

**Vite:**
```env
# .env.production
VITE_API_URL=https://your-app.example.com
```
```ts
// src/api.ts
const BASE = import.meta.env.VITE_API_URL ?? '';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as T;
}
```

**CRA:**
```env
# .env.production
REACT_APP_API_URL=https://your-app.example.com
```
```ts
const BASE = process.env.REACT_APP_API_URL ?? '';
```

In local dev the var is unset (empty string), so relative paths hit your local dev server
as usual. In the desktop build it is baked in at `npm run build` time.

---

## 6. Checklist

- [ ] Vite `base: '/'` (or CRA with `homepage` unset/`"/"`).
- [ ] Router configured (`BrowserRouter` or `HashRouter` — both work on reload).
- [ ] `index.html` present at the build-folder root.
- [ ] All `window.desktop` calls feature-guarded.
- [ ] `VITE_API_URL` / `REACT_APP_API_URL` set in `.env.production` pointing to your deployed backend.
- [ ] All backend `fetch` calls use absolute URLs (never relative `/api/…`).
- [ ] `buildFolder` → `dist/` (Vite) or `build/` (CRA).
