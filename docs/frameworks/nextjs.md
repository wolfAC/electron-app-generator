# Next.js → Electronify

> Read [README.md](./README.md) first — the five universal rules apply here too.

Next.js is the **trickiest** framework to ship in Electronify because so much of it
assumes a Node server. You must use the **static export** and turn off everything that
needs a runtime.

---

## 1. Required `next.config.js`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // emit a fully static site to ./out
  images: { unoptimized: true }, // no image-optimization server exists
  trailingSlash: false, // see the routing note below — neither setting is "safe"
  // Leave assetPrefix/basePath UNSET. Do NOT set assetPrefix to './' — Next emits
  // absolute /_next/... URLs, which resolve correctly under app://local/.
};
module.exports = nextConfig;
```

Build:

```bash
next build      # produces ./out  (no separate `next export` since Next 14)
```

Point Electronify at it:

```json
// electronify/config.json
"buildFolder": "../my-next-app/out"
```

---

## 2. What you MUST NOT use

`output: 'export'` makes Next refuse to build if you use any server feature. Remove:

- **`app/api/**`route handlers** / pages`api/` — no server to run them. Call an external
  API over the network instead (mind CORS, see README).
- **SSR / `getServerSideProps`** — replace with `getStaticProps` / `generateStaticParams`.
- **ISR / `revalidate`** — static only.
- **`middleware.ts`** — runs on the edge/server; not available.
- **`next/image` optimization** — requires `images.unoptimized: true` (set above).
- **Server Actions, `cookies()`, `headers()`, draft mode** — server-only.
- **Dynamic routes without `generateStaticParams`** — every page must be enumerable at
  build time so it can be exported to a file.

---

## 3. Routing — multi-page export

Next static export writes **one HTML file per route** (`/about` → `out/about.html`, or
`out/about/index.html` with `trailingSlash: true`). The generated protocol handler
resolves both forms: a request for `app://local/about` is served from `web/about.html`
**or** `web/about/index.html`, whichever exists. So:

- In-app `<Link>` navigation works (the app boots at `/` and the client router hydrates).
- A **hard reload or deep link** to `/about` now loads the correct exported page.

Requirements for this to work:

- Every route must be **statically exported** — list dynamic segments in
  `generateStaticParams` so a file exists for each. A route with no exported file falls
  back to the home page.
- Pick `trailingSlash` and keep it consistent; both `false` (→ `about.html`) and `true`
  (→ `about/index.html`) are handled.
- Catch-all/fully-dynamic routes that can't be enumerated at build time won't have files
  and won't deep-link — for those, either pre-render the known set or rely on client-side
  `<Link>` navigation from `/`.

---

## 4. API calls & data fetching

This is the most common Next.js → desktop gotcha. There are **two** kinds of "API calls",
and they behave very differently.

### 4.1 Next.js API Routes — NOT available

`app/api/**/route.ts` and `pages/api/*` are **server functions**. `output: 'export'` has
no server, so they don't run — and `next build` will error if they're present. Move that
logic to one of:

- a **separate hosted backend** you call over the network (see §4.2), or
- the **Electron main process** as a new `window.desktop` IPC handler (a generator/plugin
  change — see `CLAUDE.md` "How to Add a New Feature"), or
- the **client**, if it needs no server/secrets.

Server Actions, `getServerSideProps`, `route.ts` handlers, and `middleware.ts` are all
unavailable for the same reason.

### 4.2 Calling a remote backend with `fetch`/axios — works, with 3 rules

Client-side requests to your hosted API or a third-party API **do work**. But:

1. **Use absolute URLs, never relative.** A relative path is resolved against the app's
   own origin and hits the static files, not a server:

   ```js
   fetch("/api/users"); // ❌ → app://local/api/users → returns index.html
   //    HTML, so response.json() throws
   fetch("https://api.myapp.com/users"); // ✅ goes over the network
   ```

   Put the base URL in an env var baked at build time (`NEXT_PUBLIC_API_URL`) so the same
   code works in the browser and the desktop build.

2. **The server must allow CORS from `app://local`.** Every call is cross-origin (the page
   origin is `app://local`). The backend needs `Access-Control-Allow-Origin: app://local`
   (or `*`) and must answer preflight `OPTIONS`. If you don't control it, proxy it.

3. **Prefer tokens over cookies.** Domain cookies aren't sent to `app://local`. Use bearer
   tokens and store them via `window.desktop.secureStore` (OS-encrypted), not cookies.

`app://local` is a **secure context**, so calling a plain `http://` endpoint can be
blocked as mixed content — use `https` (matters for local dev servers).

**Setting up the env var:**

```env
# .env.production  (safe to commit — no secrets here)
NEXT_PUBLIC_API_URL=https://your-app.vercel.app
```

```ts
// src/lib/api.ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as T;
}
```

```tsx
// usage — same code in browser and desktop build
import { apiFetch } from "@/lib/api";
const users = await apiFetch<User[]>("/api/users");
```

In local dev (`next dev`), leave `NEXT_PUBLIC_API_URL` unset (empty string) so relative
paths resolve to your local Next dev server, where API routes _do_ run. In the desktop
build the var is baked in at `next build` time — no runtime config needed.

---

## 5. Asset paths

Next export emits absolute `/_next/static/...` URLs. Under `app://local/` these resolve
to `web/_next/static/...` correctly — **leave `assetPrefix` and `basePath` unset.**
If you see `Unexpected token '<'` in the console, an asset 404'd into the fallback HTML;
check that you did not set a `basePath`/`assetPrefix` that shifts the URLs.

Use `next/font` (self-hosts fonts into the build) rather than runtime Google Fonts CSS,
so fonts ship offline.

---

## 6. Native APIs — using every feature

See [README.md → The complete feature surface](./README.md#the-complete-feature-surface)
for the full table. Because Next renders on the server first, **`window` doesn't exist
during SSR/prerender** — read the bridge inside `useEffect`, never at module top level.

```ts
// lib/desktop.ts
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
declare global {
  interface Window {
    desktop?: DesktopAPI;
  }
}
```

```tsx
// hooks/useDesktop.ts
"use client";
import { useEffect, useState } from "react";
import type { DesktopAPI } from "@/lib/desktop";

export function useDesktop() {
  const [desktop, setDesktop] = useState<DesktopAPI | null>(null);
  useEffect(() => {
    setDesktop(window.desktop ?? null);
  }, []); // client-only
  return { desktop, isDesktop: !!desktop };
}
```

A client component touching **every** capability:

```tsx
"use client";
import { useDesktop } from "@/hooks/useDesktop";
import { tintIcon } from "@/lib/tintIcon"; // same canvas helper as react.md §4.1

export default function DesktopPanel() {
  const { desktop: d, isDesktop } = useDesktop();
  if (!isDesktop) return <p>Browser mode — desktop features hidden.</p>;

  return (
    <div>
      <button
        onClick={() => d!.notify({ title: "Done", body: "Export finished" })}
      >
        Notify
      </button>
      <button onClick={async () => alert(await d!.getVersion())}>
        Version
      </button>
      <button onClick={async () => console.log(await d!.openFile())}>
        Open file(s)
      </button>
      <button onClick={async () => console.log(await d!.openFolder())}>
        Open folder
      </button>
      <button
        onClick={async () => {
          const p = await d!.saveFile({ defaultName: "export.csv" });
          if (p) console.log(p);
        }}
      >
        Save as…
      </button>
      <button onClick={() => d!.secureStore.set("apiKey", "secret-123")}>
        Store secret
      </button>
      <button onClick={async () => alert(await d!.secureStore.get("apiKey"))}>
        Read secret
      </button>
      <button onClick={() => d!.secureStore.delete("apiKey")}>
        Delete secret
      </button>
      <button onClick={async () => alert((await d!.checkForUpdates()).status)}>
        Check updates
      </button>
      <button
        onClick={async () => d!.setIcon(await tintIcon("/logo.png", "#6366f1"))}
      >
        Tint icon
      </button>
    </div>
  );
}
```

The icon-tint helper is identical to [react.md §4.1](./react.md). Dialog paths are opaque
strings; act on them via a plugin or your backend. No Node.js in the renderer.

### 6.1 Config features (no code)

`tray`, `menuBar`, `singleInstance`, `autoUpdater`, and window sizing live in
`electronify/config.json` — see the README feature table. Drag & drop is plain HTML5
(`onDragOver`/`onDrop`); the `dragDrop` flag does not gate it.

### 6.2 Feature prerequisites

Every `window.desktop` method is usable from the renderer immediately, but some need
setup outside your web code before they work end-to-end.

| Feature                                      | What you need                                                                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notify({ title, body })`                    | Nothing in your web code — uses Electron's main-process `Notification`, not the browser API. No `Notification.requestPermission()` needed. Set a unique `"appId"` in `config.json` so Windows groups toasts correctly under your app. |
| `openFile()` / `openFolder()` / `saveFile()` | Nothing. Returned values are opaque OS path strings. The sandboxed renderer **cannot** read or write files at those paths — pass the path to your backend API or a generator plugin to act on them.                                   |
| `secureStore.set/get/delete`                 | Nothing on macOS/Windows (`safeStorage` uses the OS keychain). On Linux, falls back to unencrypted storage if no GNOME Keyring / KWallet is running — warn the user in that case.                                                     |
| `checkForUpdates()`                          | `"autoUpdater": true` in `config.json` **and** a configured update-server URL (GitHub releases or custom HTTP). Without it the call resolves to `{ status: 'disabled' }`.                                                             |
| `setIcon(dataUrlPng)`                        | A 256×256+ PNG as a base64 data URL. Use the `tintIcon` helper (see `react.md §4.1`) to generate one at runtime from any image.                                                                                                       |
| `fetch` to your backend                      | Absolute URL via `NEXT_PUBLIC_API_URL` (see §4.2). The server must respond with `Access-Control-Allow-Origin: app://local` (or `*`) and handle `OPTIONS` preflight.                                                                   |

---

## 7. Checklist

- [ ] `output: 'export'` and `images.unoptimized: true` in `next.config.js`.
- [ ] No API routes, SSR, ISR, middleware, or Server Actions.
- [ ] `NEXT_PUBLIC_API_URL` set in `.env.production` pointing to your deployed backend.
- [ ] All backend `fetch` calls use **absolute** URLs via `NEXT_PUBLIC_API_URL` (never relative `/api/…`).
- [ ] Backend sends CORS headers allowing `app://local`.
- [ ] All dynamic routes have `generateStaticParams` / static params.
- [ ] `out/index.html` exists after `next build`.
- [ ] No `basePath`/`assetPrefix` shifting `/_next/...` URLs.
- [ ] `buildFolder` → `.../out`.
