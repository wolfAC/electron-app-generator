# Angular → Electronify

> Read [README.md](./README.md) first — the five universal rules apply here too.

Angular SPAs run well in Electronify once you fix the **`base href`**, the **router
location strategy**, and (for Angular 17+) make sure you're producing a **client-side
bundle**, not an SSR app.

---

## 1. Build a static, browser-only bundle

Build for production:

```bash
ng build --configuration production
```

Output location depends on Angular version:

- **Angular 17+** (application builder): `dist/<app-name>/browser/`
- **Older** (`browser` builder): `dist/<app-name>/`

Point Electronify at the folder that actually contains `index.html`:

```json
// electronify/config.json
"buildFolder": "../my-ng-app/dist/my-ng-app/browser"
```

> **Do not ship SSR/SSG output.** If you enabled `@angular/ssr` / `ng add @angular/ssr`,
> the build emits a `server/` folder and expects a Node server — Electronify has none.
> Either remove SSR, or use only the `browser/` sub-folder and ensure the app runs purely
> client-side (no server-only `TransferState` dependencies, no hydration that requires
> server HTML).

---

## 2. `base href` — set it to `/`

Angular needs a `<base href>` to resolve assets and router URLs. The default `/` is
correct for `app://local/` (assets resolve to `web/...`). Build with:

```bash
ng build --configuration production --base-href /
```

or keep `<base href="/">` in `src/index.html`.

> **Do not set `--base-href ./`.** Relative base appears to work at the root but breaks
> when lazy-loaded route bundles are requested while the router is on a deep path — the
> same reason described in the README. Use absolute `/`.

---

## 3. Routing — `PathLocationStrategy` or `HashLocationStrategy` both work

A single-page Angular app has one `index.html`, so a route like `/settings` has no
matching file. The protocol handler detects the document navigation and falls back to the
root `index.html` **with the URL preserved**, and the Angular router renders the route. So
the default `PathLocationStrategy` (HTML5 URLs) works on hard reload and deep links — make
sure `<base href="/">` is set (see §2).

If you prefer hash URLs (`app://local/#/settings`), which stay out of the protocol handler
entirely, enable them either way:

**Option A — `RouterModule` (NgModule apps):**

```ts
@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
})
export class AppRoutingModule {}
```

**Option B — standalone bootstrap (Angular 15+):**

```ts
import { provideRouter, withHashLocation } from '@angular/router';

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes, withHashLocation())],
});
```

Hash location is optional now — pick whichever URL style you prefer.

---

## 4. Native APIs — using every feature

See [README.md → The complete feature surface](./README.md#the-complete-feature-surface)
for the full table. Declare the bridge for TypeScript:

```ts
// src/desktop.d.ts
interface DesktopBridge {
  notify(o: { title: string; body: string }): Promise<void>;
  getVersion(): Promise<string>;
  openFile(): Promise<string[] | null>;
  openFolder(): Promise<string[] | null>;
  saveFile(o: { defaultName: string }): Promise<string | null>;
  secureStore: {
    set(k: string, v: string): Promise<{ success: boolean }>;
    get(k: string): Promise<string | null>;
    delete(k: string): Promise<{ success: boolean }>;
  };
  checkForUpdates(): Promise<{ status: string; result?: unknown }>;
  setIcon(dataUrlPng: string): Promise<{ success: boolean; error?: string }>;
}
declare global { interface Window { desktop?: DesktopBridge } }
export {};
```

A service wrapping **every** method:

```ts
// src/app/desktop.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DesktopService {
  private readonly d = typeof window !== 'undefined' ? window.desktop ?? null : null;
  readonly available = !!this.d;

  notify(title: string, body: string)      { return this.d?.notify({ title, body }); }
  getVersion()                             { return this.d?.getVersion(); }
  openFile()                               { return this.d?.openFile(); }
  openFolder()                             { return this.d?.openFolder(); }
  saveFile(defaultName: string)            { return this.d?.saveFile({ defaultName }); }
  storeSet(key: string, value: string)     { return this.d?.secureStore.set(key, value); }
  storeGet(key: string)                    { return this.d?.secureStore.get(key); }
  storeDelete(key: string)                 { return this.d?.secureStore.delete(key); }
  checkForUpdates()                        { return this.d?.checkForUpdates(); }
  setIcon(dataUrlPng: string)              { return this.d?.setIcon(dataUrlPng); }
}
```

Use it from a component:

```ts
constructor(private desktop: DesktopService) {}

async demo() {
  if (!this.desktop.available) return;
  await this.desktop.notify('Hi', 'Native notification');
  console.log(await this.desktop.getVersion());
  console.log(await this.desktop.openFile());
  console.log(await this.desktop.openFolder());
  const path = await this.desktop.saveFile('export.csv'); // opaque OS path or null
  await this.desktop.storeSet('apiKey', 'secret-123');
  console.log(await this.desktop.storeGet('apiKey'));
  await this.desktop.storeDelete('apiKey');
  console.log((await this.desktop.checkForUpdates())?.status);
  await this.desktop.setIcon(await tintIcon('/logo.png', '#6366f1')); // see §4.1
}
```

No Node.js APIs in the renderer (`sandbox: true`) — interact only through `window.desktop`.

### 4.1 Icon tinting helper

`setIcon` takes a base64 PNG data URL, generated on a canvas (no dependencies):

```ts
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

`tray`, `menuBar`, `singleInstance`, `autoUpdater`, and window sizing live in
`electronify/config.json` — see the README feature table. Drag & drop is plain HTML5
(`(dragover)`/`(drop)`) in your templates; the `dragDrop` flag does not gate it.

### 4.3 Feature prerequisites

Every `window.desktop` method is usable from the renderer immediately, but some need
setup outside your web code before they work end-to-end.

| Feature | What you need |
|---------|---------------|
| `notify({ title, body })` | Nothing in your web code — uses Electron's main-process `Notification`, not the browser API. No `Notification.requestPermission()` needed. Set a unique `"appId"` in `config.json` so Windows groups toasts correctly under your app. |
| `openFile()` / `openFolder()` / `saveFile()` | Nothing. Returned values are opaque OS path strings. The sandboxed renderer **cannot** read or write files at those paths — pass the path to your backend API or a generator plugin to act on them. |
| `secureStore.set/get/delete` | Nothing on macOS/Windows (`safeStorage` uses the OS keychain). On Linux, falls back to unencrypted storage if no GNOME Keyring / KWallet is running. |
| `checkForUpdates()` | `"autoUpdater": true` in `config.json` **and** a configured update-server URL. Without it the call resolves to `{ status: 'disabled' }`. |
| `setIcon(dataUrlPng)` | A 256×256+ PNG as a base64 data URL. Use the `tintIcon` helper (see §4.1) to generate one at runtime. |
| `HttpClient` to your backend | Set `apiUrl` in `environment.prod.ts` (see §5). The server must send `Access-Control-Allow-Origin: app://local` and handle `OPTIONS` preflight. |

---

## 5. HTTP & storage

- `HttpClient` calls to your backend are cross-origin from `app://local` → enable CORS
  server-side. Interceptors that rely on same-origin cookies won't work; prefer tokens
  stored via `window.desktop.secureStore`.
- `localStorage`/`IndexedDB` work because `app://local` is a secure origin.
- Service Worker (`@angular/pwa`) works under the custom scheme, but offline caching of an
  already-local app is usually redundant — test before relying on it.

**Setting up the API base URL via Angular environments:**

```ts
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://your-app.example.com',
};

// src/environments/environment.ts  (local dev)
export const environment = {
  production: false,
  apiUrl: '',   // empty → HttpClient uses relative URLs against the local dev server
};
```

```ts
// src/app/api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  get<T>(path: string) { return this.http.get<T>(`${this.base}${path}`); }
  post<T>(path: string, body: unknown) { return this.http.post<T>(`${this.base}${path}`, body); }
}
```

`ng build --configuration production` automatically swaps in `environment.prod.ts`, so the
desktop build uses the deployed URL without any extra tooling.

---

## 6. Checklist

- [ ] Production build is browser-only (no `server/` / SSR runtime needed).
- [ ] `buildFolder` points at the folder containing `index.html` (`.../browser` on v17+).
- [ ] `--base-href /` (absolute), not `./`.
- [ ] Routing works on reload (`PathLocationStrategy` with `<base href="/">`, or hash).
- [ ] `window.desktop` typed and feature-guarded.
- [ ] `apiUrl` set in `environment.prod.ts` pointing to your deployed backend.
- [ ] All `HttpClient` calls go through `ApiService` (absolute URL via environment).
- [ ] Backend allows CORS from `app://local`.
