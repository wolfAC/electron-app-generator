# Vue → Electronify

> Read [README.md](./README.md) first — the five universal rules apply here too.

Vue SPAs ship well in Electronify. The two things to get right are the **base path** and
**Vue Router's history mode**. (If you use **Nuxt**, see the note at the bottom — it
behaves like Next.js.)

---

## 1. Vite + Vue (recommended)

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  base: '/',          // absolute paths resolve under app://local/  ✅
  build: { outDir: 'dist' },
});
```

> **Do not use `base: './'`.** That's a `file://` workaround. Electronify serves over a
> real `app://local` origin, so absolute `/assets/...` URLs are correct and robust for
> lazy-loaded route chunks; relative bases break on deep routes.

Vue CLI users: set `publicPath: '/'` in `vue.config.js` (the default), **not** `'./'`.

Build → `buildFolder`:

```bash
npm run build      # → dist/
```
```json
"buildFolder": "../my-vue-app/dist"
```

---

## 2. Routing — `createWebHistory` or `createWebHashHistory` both work

A single-page Vue app has one `index.html`, so a route like `/about` has no matching file.
The protocol handler detects the document navigation and falls back to the root
`index.html` **with the URL preserved**, and Vue Router renders the route. So HTML5
history mode works on hard reload and deep links:

```ts
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),       // ✅ works on reload under app://local/
  routes: [
    { path: '/', component: Home },
    { path: '/about', component: About },
  ],
});
```

`createWebHashHistory()` (`app://local/#/about`) is equally fine and keeps routes out of
the protocol handler entirely — use it if you prefer, but it's no longer required.

---

## 3. Native APIs — using every feature

See [README.md → The complete feature surface](./README.md#the-complete-feature-surface)
for the full table. Below is a typed composable that exposes **all** of them.

```ts
// src/composables/useDesktop.ts
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

export function useDesktop() {
  const desktop = typeof window !== 'undefined' ? window.desktop ?? null : null;
  return { desktop, isDesktop: !!desktop };
}
```

A component using **every** capability:

```vue
<script setup lang="ts">
import { useDesktop } from '@/composables/useDesktop';
import { tintIcon } from '@/composables/tintIcon'; // see §3.1
const { desktop: d, isDesktop } = useDesktop();
</script>

<template>
  <p v-if="!isDesktop">Running in a browser — desktop features hidden.</p>
  <div v-else>
    <button @click="d!.notify({ title: 'Hi', body: 'Native notification' })">Notify</button>
    <button @click="async () => alert(await d!.getVersion())">Version</button>
    <button @click="async () => console.log(await d!.openFile())">Open file(s)</button>
    <button @click="async () => console.log(await d!.openFolder())">Open folder</button>
    <button @click="async () => { const p = await d!.saveFile({ defaultName: 'export.csv' }); if (p) console.log(p); }">Save as…</button>
    <button @click="d!.secureStore.set('apiKey', 'secret-123')">Store secret</button>
    <button @click="async () => alert(await d!.secureStore.get('apiKey'))">Read secret</button>
    <button @click="d!.secureStore.delete('apiKey')">Delete secret</button>
    <button @click="async () => alert((await d!.checkForUpdates()).status)">Check updates</button>
    <button @click="async () => d!.setIcon(await tintIcon('/logo.png', '#6366f1'))">Tint icon</button>
  </div>
</template>
```

No Node.js in the renderer. Dialog paths are opaque strings — act on them via a plugin or
your backend.

### 3.1 Icon tinting helper

`setIcon` takes a base64 PNG data URL, generated on a canvas (no dependencies):

```ts
// src/composables/tintIcon.ts
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

### 3.2 Config features (no code)

`tray`, `menuBar`, `singleInstance`, `autoUpdater`, and window sizing live in
`electronify/config.json` — see the README feature table. Drag & drop is plain HTML5
(`@dragover`/`@drop`) in your components; the `dragDrop` flag does not gate it.

### 3.3 Feature prerequisites

Every `window.desktop` method is usable from the renderer immediately, but some need
setup outside your web code before they work end-to-end.

| Feature | What you need |
|---------|---------------|
| `notify({ title, body })` | Nothing in your web code — uses Electron's main-process `Notification`, not the browser API. No `Notification.requestPermission()` needed. Set a unique `"appId"` in `config.json` so Windows groups toasts correctly under your app. |
| `openFile()` / `openFolder()` / `saveFile()` | Nothing. Returned values are opaque OS path strings. The sandboxed renderer **cannot** read or write files at those paths — pass the path to your backend API or a generator plugin to act on them. |
| `secureStore.set/get/delete` | Nothing on macOS/Windows (`safeStorage` uses the OS keychain). On Linux, falls back to unencrypted storage if no GNOME Keyring / KWallet is running. |
| `checkForUpdates()` | `"autoUpdater": true` in `config.json` **and** a configured update-server URL. Without it the call resolves to `{ status: 'disabled' }`. |
| `setIcon(dataUrlPng)` | A 256×256+ PNG as a base64 data URL. Use the `tintIcon` helper (see §3.1) to generate one at runtime. |
| `fetch` to your backend | Absolute URL via an env var (see §4). The server must send `Access-Control-Allow-Origin: app://local` and handle `OPTIONS` preflight. |

---

## 4. State & storage

Pinia/Vuex persistence to `localStorage`/`IndexedDB` works because `app://local` is a
secure origin. For secrets, prefer `window.desktop.secureStore` (OS-encrypted via
`safeStorage`) over plain `localStorage`.

**Setting up the API base URL via env (Vite):**

```env
# .env.production
VITE_API_URL=https://your-app.example.com
```

```ts
// src/composables/api.ts
const BASE = import.meta.env.VITE_API_URL ?? '';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as T;
}
```

In local dev the var is unset (empty string), so relative paths resolve to your local Vite
dev server. In the desktop build it is baked in at `npm run build` time.

---

## 5. Nuxt note

Nuxt is server-oriented like Next.js. To target Electronify you must **pre-render to a
static site**:

```bash
npx nuxi generate          # static output in .output/public
```

```json
"buildFolder": "../my-nuxt-app/.output/public"
```

- Use `ssr: false` (SPA) or full static generation; no server routes / Nitro server
  endpoints at runtime.
- The same per-route file vs. SPA-fallback caveat from `nextjs.md` applies — prefer a
  single-entry app or client-only navigation.

---

## 6. Checklist

- [ ] Vite `base: '/'` (or Vue CLI `publicPath: '/'`).
- [ ] Router configured (`createWebHistory` or `createWebHashHistory` — both work).
- [ ] `index.html` at the build-folder root.
- [ ] `window.desktop` calls feature-guarded.
- [ ] `VITE_API_URL` set in `.env.production` pointing to your deployed backend.
- [ ] All backend `fetch` calls use absolute URLs (never relative `/api/…`).
- [ ] Nuxt: `nuxi generate`, `buildFolder` → `.output/public`.
