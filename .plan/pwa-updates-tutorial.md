# Why Your Deploys Didn't Show Up — A Service Worker Tutorial

> A from-scratch explanation of what a service worker is, why this app kept
> serving stale versions after a deploy, and exactly what changed to fix it.
>
> Written for someone who has never touched a service worker before.

---

## Table of Contents

1. [The Problem, In Plain English](#1-the-problem-in-plain-english)
2. [Background: How a Browser Loads Your App](#2-background-how-a-browser-loads-your-app)
3. [Background: The Two Caches](#3-background-the-two-caches)
4. [What Is a Service Worker?](#4-what-is-a-service-worker)
5. [What Is a PWA?](#5-what-is-a-pwa)
6. [The Service Worker Lifecycle](#6-the-service-worker-lifecycle)
7. [What Workbox and vite-plugin-pwa Do For You](#7-what-workbox-and-vite-plugin-pwa-do-for-you)
8. [Diagnosing This Project's Bug](#8-diagnosing-this-projects-bug)
9. [The Root Cause](#9-the-root-cause)
10. [The Fix, Step by Step](#10-the-fix-step-by-step)
11. [The New Update Flow, End to End](#11-the-new-update-flow-end-to-end)
12. [How to Verify It Works](#12-how-to-verify-it-works)
13. [Gotchas, Edge Cases, and Trade-offs](#13-gotchas-edge-cases-and-trade-offs)
14. [Glossary](#14-glossary)

---

## 1. The Problem, In Plain English

You deploy a new version of the app. On your laptop it works. On your phone,
still the old version. You refresh. Still old. You clear the browser cache.
Now it's new. On a phone where the app is installed to the home screen, even
clearing the cache doesn't help — you have to delete the icon and re-add it.

That is the classic symptom of **a stale Service Worker**.

The service worker is a small script that sits between your app and the
network and decides what to serve. It was serving the old version from its own
private cache, and nothing was telling it to look for a new version.

To understand why, we need to start at the very beginning.

---

## 2. Background: How a Browser Loads Your App

When you open a normal website, the browser does roughly this:

```
   You type the URL
          │
          ▼
   DNS lookup  ──►  finds the server's IP address
          │
          ▼
   HTTP request  ──►  GET /index.html
          │
          ▼
   Server responds with HTML
          │
          ▼
   Browser parses HTML, finds <script> and <link> tags
          │
          ▼
   Browser downloads the JS and CSS, runs the JS
          │
          ▼
   Your React app renders
```

**This app is a Single Page Application (SPA).** The key word is *single*.
The server sends one `index.html`. After that, the React app takes over:

- Clicking a link does **not** ask the server for a new page.
- The app swaps React components in and out, called **client-side routing**
  (you use TanStack Router for this).
- You can use the app for an hour and the browser never does another full
  page load.

That last point is the seed of the whole problem. Remember it.

### Versioned filenames

When Vite builds the app, it names the JavaScript files with a content hash:

```
assets/index-DFacidy0.js
assets/index-_wcRL-b_.js    ← different content = different name
```

If the content changes, the filename changes. This is deliberate: it lets the
browser cache each file **forever** safely, because a new build produces new
filenames. The files that are *not* hashed — `index.html`, `sw.js`,
`manifest.webmanifest` — must never be cached for long, because their names
never change but their contents do.

---

## 3. Background: The Two Caches

Here is a fact that trips up almost everyone: **there are two separate caches**
in a modern web app.

```
┌─────────────────────────────────────────────────────────────┐
│  Cache #1: The Browser HTTP Cache                           │
│  ────────────────────────────────────────                   │
│  Managed by the browser. Stores responses to normal         │
│  fetch() calls according to Cache-Control headers.          │
│  Cleared when the user "clears browsing data".              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Cache #2: The Service Worker Cache (Cache Storage)         │
│  ───────────────────────────────────────────────────────────│
│  Managed by YOUR service worker code. Stores responses      │
│  explicitly. Survives "clear browser cache" in many cases,  │
│  and survives closing the tab.                              │
└─────────────────────────────────────────────────────────────┘
```

When you "force refresh" (`Cmd+Shift+R`), you are bypassing **Cache #1**. If
the content still looks old, it is almost always **Cache #2** — the service
worker cache — that is winning. That is exactly what kept happening here.

---

## 4. What Is a Service Worker?

A **service worker** is a JavaScript file that runs **separately from your web
page**. It is not part of the page's JS. It gets its own thread, its own
lifetime, and it can be running even when no tab is open.

### A useful analogy

Think of the service worker as a **receptionist sitting between your app and
the internet**.

```
   Your React app  ──►  Service Worker (receptionist)  ──►  The Internet
   "I need /index.html"      "Do I have that on file?        (your server / CDN)
                              Yes → hand it over (fast)
                              No  → go fetch it, then
                                    file a copy for next time"
```

Because the receptionist keeps copies ("files") of everything, the app can
load with no network at all — this is how offline support works.

### What a service worker can do

- **Intercept every network request** your page makes (`fetch` events).
- **Respond from its own cache** instead of the network.
- **Pre-download files** in the background so they're ready offline.
- Receive **push notifications** and **background sync** events (not used here).

### What a service worker cannot do

- It cannot touch the DOM or `window` directly.
- It cannot run forever — the browser starts and stops it as needed.
- It runs on a separate thread, so it does not block your UI.

### Key properties

| Property | Meaning |
|---|---|
| **Scope** | A URL prefix it controls. Here it is `/`, so it controls the entire site. |
| **Separate lifetime** | It can live across page reloads and even with no tabs open. |
| **Requires HTTPS** | (Or `localhost`.) A security requirement. |
| **Event-driven** | It wakes up only when there is an event: `install`, `activate`, `fetch`, `message`, etc. |

---

## 5. What Is a PWA?

A **Progressive Web App (PWA)** is a normal website plus two extra things:

1. A **web app manifest** — a JSON file describing the app's name, icons, and
   that it should open full-screen. This is what lets a phone "install" it to
   the home screen.
2. A **service worker** — which provides offline support and caching.

Your `vite.config.ts` defines the manifest inline:

```ts
manifest: {
  name: 'Vibe My Life',
  short_name: 'VML',
  display: 'standalone',   // full-screen, no browser chrome
  theme_color: '#a855f7',
  icons: [ /* ... */ ],
}
```

An **installed** PWA (home-screen icon on iOS/Android) is where the staleness
problem is worst, because the browser never performs a visible "navigation"
that would trigger an update check. The app opens, resumes, and sits there
running old code.

---

## 6. The Service Worker Lifecycle

This is the single most important concept in this document. Every service
worker moves through these states:

```
        register('/sw.js')
              │
              ▼
        ┌───────────┐
        │  INSTALL  │  Download and cache assets ("precache").
        └─────┬─────┘  If anything fails, the SW is discarded.
              │
              ▼
        ┌───────────┐
        │ INSTALLED │  Ready, but NOT yet controlling the page.
        │ (WAITING) │  This is where a new version waits.
        └─────┬─────┘
              │  (activates when old one is gone,
              │   OR immediately if skipWaiting() is called)
              ▼
        ┌───────────┐
        │ ACTIVATE  │  Clean up old caches, take over.
        └─────┬─────┘
              │
              ▼
        ┌───────────┐
        │ ACTIVATED │  Now intercepting fetch events.
        │(CONTROLLING)│
        └───────────┘
```

### The critical detail

When you deploy a new version:

- The browser fetches the new `sw.js`.
- The new service worker installs and enters the **WAITING** state.
- **It does not activate while the old one is still controlling open pages.**
  This is by design — it prevents two versions fighting over the same page.
- The waiting worker only activates when:
  - all tabs/pages controlled by the old worker are closed, **or**
  - the new worker calls `self.skipWaiting()`.

Even after activation, the page that is already open is still running the
**old JavaScript that it already loaded**. To get the new code, the page must
**reload**.

So there are two independent hurdles for an update to reach the user:

```
   Hurdle 1: The browser must DISCOVER the new sw.js.
   Hurdle 2: The waiting worker must ACTIVATE, and the page must RELOAD.
```

This project failed at **Hurdle 1**.

### Why the browser is lazy about discovering updates

The browser does **not** poll `sw.js` every few seconds. It checks:

- on a **full page navigation** (not a SPA route change),
- on some functional events (`push`, `sync`),
- when your code explicitly calls `registration.update()`,
- and on a slow, unreliable background schedule (roughly every 24h, and
  implementation-specific).

For a normal multi-page website, that's fine — every click is a navigation.
For a **SPA that stays open**, especially an **installed PWA**, there may be
no navigation for days. So the browser never checks. That is the bug.

---

## 7. What Workbox and vite-plugin-pwa Do For You

Writing a production service worker by hand is painful. Two tools handle it:

### Workbox

[Workbox](https://developer.chrome.com/docs/workbox/) is Google's library for
service workers. It gives you:

- **Precaching**: a list of files to download and store on install, with
  revision hashes so changed files are re-downloaded.
- **Routing**: strategies for matching requests to responses, e.g.
  - `NetworkFirst` — try network, fall back to cache (used for your API).
  - `CacheFirst` — serve cache, only fetch if missing.
- **`NavigationRoute`**: a special route that catches page navigations and
  serves your cached `index.html` (this is what makes a SPA work offline).
- **`workbox-window`**: the *page-side* helper that talks to the worker and
  can listen for update events.

### vite-plugin-pwa

`vite-plugin-pwa` wires Workbox into your Vite build. At build time it:

1. Scans `dist/` for built files.
2. Generates `sw.js` containing the precache manifest.
3. Optionally injects a small script into `index.html` to register the SW.
4. Generates `manifest.webmanifest`.

The generated `sw.js` ends with something like:

```js
s.cleanupOutdatedCaches(),
s.registerRoute(new s.NavigationRoute(s.createHandlerBoundToURL("index.html"))),
s.registerRoute(/^https?:.*\/api\/.*$/i, new s.NetworkFirst({
  cacheName: "api-cache", networkTimeoutSeconds: 3,
  plugins: [new s.ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 3600 })]
}), "GET")
```

Translated to plain English:

- "Delete caches from old versions."
- "For every page navigation, serve my precached `index.html`."
- "For `/api/*` GET requests, try the network first (3s timeout), then the
  cache; keep at most 100 entries for 1 hour."

Notice the `NavigationRoute` line. That is why the stale app reloaded to the
*old* `index.html`: the service worker served its own copy and never even
asked the server.

### `registerType`: `prompt` vs `autoUpdate`

This setting controls what the generated `sw.js` does when a new worker is
installed:

| Value | Generated SW behavior | Result |
|---|---|---|
| `'autoUpdate'` | Adds `self.skipWaiting()` and `clientsClaim()` to the worker | New worker activates immediately and can take over open pages |
| `'prompt'` | Adds **no** auto-activation at all | New worker waits until the app explicitly sends it a `SKIP_WAITING` message |

Important nuance: **`autoUpdate` only controls worker behavior.** It does
*not*, by itself, trigger the browser to go look for a new worker, and it does
not reload the page for you. That requires the page-side client
(`workbox-window` via `virtual:pwa-register`). This misunderstanding is the
heart of the original bug.

---

## 8. Diagnosing This Project's Bug

### The original config

```ts
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,mp3}'],
    runtimeCaching: [ /* api NetworkFirst */ ],
  },
  manifest: { /* ... */ },
})
```

On the surface this looked correct — a very common copy-paste recommendation
is "just use `autoUpdate`". But let's look at what the build *actually*
produced.

### The original generated registration script

vite-plugin-pwa has two ways to register the worker:

1. **Inject a plain `registerSW.js`** into `index.html`, or
2. Let your app **import the virtual module** `virtual:pwa-register`
   (or `virtual:pwa-register/react`).

If your app never imports the virtual module, the plugin defaults to option 1.
And option 1 produces a *bare* registration:

```js
// dist/registerSW.js  (the OLD build)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
  })
}
```

That's it. It registers the worker once, on first load. There is:

- no update handling,
- no `registration.update()` call,
- no reload on activation,
- no awareness that a new version exists.

The plugin's real update logic lives in the virtual module — which the app
never used. So `registerType: 'autoUpdate'` was effectively doing nothing
useful on the client side.

### The generated service worker

The old `sw.js` did include `skipWaiting()` and `clientsClaim()` (because of
`autoUpdate`), so a *newly discovered* worker would have activated. But the
problem was that a new worker was never discovered:

- SPA route changes are not full navigations → no update check.
- iOS installed PWA resumes rather than reloads → no update check.
- The browser's background check is ~daily and throttled.

So the worker sat there, forever serving the old precache.

### Summary of the failure chain

```
   Deploy new build
        │
        ▼
   New sw.js exists on server
        │
        ▼
   ❌ Nothing ever asks the browser to fetch it
      (no navigations in a SPA / installed PWA)
        │
        ▼
   Old sw.js keeps serving old cached index.html + JS
        │
        ▼
   User sees the old app
```

"Clear cache" worked because it evicted the precache. On iOS installed PWAs,
the worker's storage is tied to the install, so removing and re-adding the
home-screen icon was the only reliable way to wipe it.

---

## 9. The Root Cause

Two sentences:

> **Root cause:** This app never used vite-plugin-pwa's update-aware client.
> It used a bare `serviceWorker.register()`, and nothing in the app ever called
> `registration.update()`, so the browser was almost never prompted to look for
> a new service worker. Combined with a SPA that performs no full navigations
> (worse when installed as a PWA), the old worker and its precache persisted
> indefinitely.

The fix must:

1. Use the **real** page-side client so the app is aware of updates.
2. **Actively poll** `registration.update()` so discovery actually happens.
3. Give the user a **reload** path that activates the waiting worker.

---

## 10. The Fix, Step by Step

The changes live in six files:

| File | Purpose |
|---|---|
| `frontend/vite.config.ts` | Switch `registerType` to `'prompt'` |
| `frontend/package.json` | Add `workbox-window` dependency |
| `frontend/src/vite-env.d.ts` | Tell TypeScript about the virtual module |
| `frontend/src/hooks/useAppUpdate.ts` | **New** — detects updates and polls |
| `frontend/src/components/UpdatePrompt.tsx` | **New** — the "Refresh" banner |
| `frontend/src/main.tsx` | Mount the banner at the app root |

### Step 1 — Switch to `registerType: 'prompt'`

```ts
VitePWA({
  // 'prompt' + useAppUpdate (virtual:pwa-register/react) lets us detect a
  // new SW, show an in-app "Refresh" banner, and activate it on tap.
  registerType: 'prompt',
  // ...
})
```

**Why:** with `'prompt'`, the new worker does **not** auto-activate. It waits
until the app explicitly tells it to. This gives you control: show a banner,
let the user tap Refresh at a safe moment, then activate + reload. (With
`autoUpdate`, the app could reload in the middle of the user typing a form.)

### Step 2 — Add `workbox-window`

```bash
pnpm --filter frontend add -D workbox-window@^7.4.1
```

**Why:** the page-side client (`virtual:pwa-register`) imports
`workbox-window` at runtime. Because this is a pnpm workspace with strict,
isolated `node_modules`, a transitive dependency isn't importable by your app
code unless you declare it directly. Without this, the build fails with:

```
Rollup failed to resolve import "workbox-window" from
"/@vite-plugin-pwa/virtual:pwa-register/react"
```

### Step 3 — Teach TypeScript about the virtual module

The virtual module isn't a real file on disk, so TypeScript needs a type
declaration. In `frontend/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />   // ← added

declare module '*.css' {}
// ...
```

### Step 4 — Create the update hook

`frontend/src/hooks/useAppUpdate.ts`:

```ts
import { useCallback, useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * How often to ask the browser to re-check `/sw.js` while the app is open.
 * The browser's own periodic check is unreliable (throttled to ~24h and only
 * on full navigations), which is why an installed SPA can stay stale for days.
 */
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000

export function useAppUpdate() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration ?? null
    },
  })

  useEffect(() => {
    const checkForUpdate = () => {
      // Ignore failures (offline, transient server errors) – we retry later.
      registrationRef.current?.update().catch(() => {})
    }

    checkForUpdate()
    const intervalId = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', checkForUpdate)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', checkForUpdate)
    }
  }, [])

  const reload = useCallback(() => {
    // Tells the waiting SW to activate, then reloads the page.
    void updateServiceWorker(true)
  }, [updateServiceWorker])

  const dismiss = useCallback(() => setNeedRefresh(false), [setNeedRefresh])

  return { needRefresh, reload, dismiss }
}
```

Let's break down the non-obvious parts.

**`useRegisterSW`** is the React hook from `virtual:pwa-register/react`. It:

- registers the service worker using `workbox-window`'s `Workbox` class,
- wires up the `waiting` / `activated` events,
- exposes `needRefresh` (a boolean state) that flips to `true` when a new
  worker is waiting,
- exposes `updateServiceWorker(true)`, which sends the `SKIP_WAITING` message
  to the waiting worker and reloads the page once it takes control.

**`onRegisteredSW`** hands you the `ServiceWorkerRegistration` object. We stash
it in a ref so we can call `.update()` on it later.

**Polling.** This is the actual bug fix. We call
`registration.update()` on three triggers:

- **immediately on mount** — catch updates that happened while the app was
  closed,
- **every 60 seconds** — catch updates while the app is actively open,
- **on `visibilitychange` and `focus`** — catch updates the moment the user
  returns to the app. This is the important one for installed mobile PWAs,
  which are usually *resumed*, not reloaded.

`registration.update()` tells the browser: "go fetch `sw.js` now and compare
it byte-for-byte with the current one." If it differs, the new worker installs
and enters the waiting state, which fires `needRefresh`.

> Note: `.update()` obeys HTTP caching for `sw.js` up to 24 hours unless the
> server sends `Cache-Control: no-cache` (or `max-age=0`). Your `serve.json`
> already sends `no-cache` for `sw.js`, so this works.

### Step 5 — Build the banner

`frontend/src/components/UpdatePrompt.tsx`:

```tsx
import { useAppUpdate } from '../hooks/useAppUpdate'

export function UpdatePrompt() {
  const { needRefresh, reload, dismiss } = useAppUpdate()

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="flex w-full max-w-lg items-center gap-3 rounded-2xl border border-pink-500/40 bg-zinc-900 p-4 shadow-xl">
        <div className="flex-1">
          <p className="text-sm font-semibold text-zinc-100">A new version is available</p>
          <p className="text-xs text-zinc-400">Refresh to get the latest fixes and features.</p>
        </div>
        <button
          onClick={dismiss}
          className="px-3 py-2 text-sm text-zinc-300 hover:text-white"
        >
          Later
        </button>
        <button
          onClick={reload}
          className="rounded-xl bg-pink-500 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-600"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
```

It renders nothing until an update is waiting. `pb-[calc(env(safe-area-inset-bottom)+1rem)]`
keeps it above the iPhone home indicator.

### Step 6 — Mount it at the root

`frontend/src/main.tsx`:

```tsx
import { UpdatePrompt } from './components/UpdatePrompt'

// ...

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <UpdatePrompt />          {/* ← added */}
    </QueryClientProvider>
  </React.StrictMode>,
)
```

It is a sibling of the router, so it appears on **every** route, including the
login page, without depending on the authenticated `Layout`.

> Why this also fixes the "bare registration" issue: once your app imports
> `virtual:pwa-register`, vite-plugin-pwa detects `useImportRegister = true`
> and **stops injecting** the plain `registerSW.js` into `index.html`. So there
> is exactly one registration path — the update-aware one.

---

## 11. The New Update Flow, End to End

```
   ┌──────────────────────────────┐
   │ 1. App opens / returns to    │
   │    foreground / 60s passes   │
   └──────────────┬───────────────┘
                  ▼
   ┌──────────────────────────────┐
   │ 2. registration.update()     │  ← the key addition
   │    fetches /sw.js            │
   └──────────────┬───────────────┘
                  ▼
   ┌──────────────────────────────┐
   │ 3. Bytes differ?             │
   │    yes → new SW INSTALLS     │
   │    → enters WAITING          │
   └──────────────┬───────────────┘
                  ▼
   ┌──────────────────────────────┐
   │ 4. workbox-window fires      │
   │    'waiting' → needRefresh   │
   │    = true                    │
   └──────────────┬───────────────┘
                  ▼
   ┌──────────────────────────────┐
   │ 5. Banner appears:           │
   │    "A new version is         │
   │     available → Refresh"     │
   └──────────────┬───────────────┘
                  ▼
   ┌──────────────────────────────┐
   │ 6. User taps Refresh         │
   │    updateServiceWorker(true) │
   │    → posts SKIP_WAITING      │
   └──────────────┬───────────────┘
                  ▼
   ┌──────────────────────────────┐
   │ 7. New SW activates & claims │
   │    → page reloads            │
   │    → fresh index.html + JS   │
   └──────────────────────────────┘
```

The generated `sw.js` now only calls `skipWaiting()` in response to a
`SKIP_WAITING` message from the page:

```js
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting()
})
```

And it no longer calls `clientsClaim()`. That is precisely the "wait for the
user" behavior enabled by `registerType: 'prompt'`.

---

## 12. How to Verify It Works

### Build and inspect the output

```bash
pnpm --filter frontend build
```

Then check these three things in `frontend/dist/`:

**a) `index.html` should have NO injected registration script:**

```bash
grep -o 'register-sw[^>]*' frontend/dist/index.html || echo "no injected script (good)"
```

**b) `sw.js` should NOT auto-claim clients:**

```bash
grep -c clientsClaim frontend/dist/sw.js   # expect: 0
```

**c) The app bundle should contain the update logic:**

```bash
grep -l "workbox-window\|messageSkipWaiting" frontend/dist/assets/*.js
```

### Test in Chrome DevTools

1. Run a production preview: `pnpm --filter frontend preview`.
2. Open DevTools → **Application** → **Service Workers**.
3. You should see `sw.js` **activated and running**.
4. Under **Application** → **Cache Storage**, you'll see the Workbox precache.
5. Now simulate a deploy:
   - Change a string in the UI.
   - `pnpm --filter frontend build`.
   - Reload the page **once** (or just wait / refocus the tab).
6. Within 60 seconds, the "A new version is available" banner should appear.
7. Tap **Refresh**; confirm DevTools shows a new worker activated.

> Tip: check **Application → Service Workers → Update on reload** while
> developing. That makes DevTools check for a new worker on every reload so
> you don't wait around.

### Testing the PWA install path

Install the app to a phone home screen, then deploy a change. Bring the app to
the foreground (or reopen it). The banner should appear without any manual
cache clearing. This is the scenario that previously required deleting the
icon.

---

## 13. Gotchas, Edge Cases, and Trade-offs

### Prompt vs. silent auto-update

You chose **prompt** (user taps Refresh). If you'd rather have it update
silently:

- Set `registerType: 'autoUpdate'` again, **and** keep `useAppUpdate` polling.
- With `autoUpdate`, `workbox-window` reloads the page automatically as soon
  as the new worker activates, and `needRefresh` never fires — so drop
  `<UpdatePrompt />` (or make its `reload` a no-op).

The downside of silent reload: it can interrupt a half-filled form. The
banner is the safer default.

### `sw.js` must not be cached by a CDN

`registration.update()` is only as good as the HTTP response. If a CDN or
proxy caches `/sw.js`, the browser may see the old bytes and never install the
new worker. Keep:

```
Cache-Control: no-cache
```

on `sw.js` (and ideally on `index.html`). Your `serve.json` already does this
for both. Hashed files under `/assets/**` are safe to cache `immutable` for a
year, because their names change.

### The API cache is a separate staleness source

Your `runtimeCaching` uses `NetworkFirst` for `/api/*` with `maxAgeSeconds:
3600`. If the network is slow/unavailable, the app may show API responses up
to an hour old. That is unrelated to the app-version problem, but if you ever
see "the data looks stale but the UI is new", this is why. Lower
`maxAgeSeconds` or use `NetworkOnly` for endpoints that must always be fresh.

### React StrictMode double-registration in dev

`React.StrictMode` mounts components twice in development, so `useRegisterSW`
runs its initializer twice in dev. This is harmless (registering the same
scope twice is idempotent) and does not happen in production builds.

### One-time migration for already-stuck devices

Devices that are currently stuck on the old bare-registered worker will only
pick up this new client on their **next full load**. Once they load the new
build, the update-aware client takes over and future deploys flow normally.
Practically: tell users to force-refresh once, or just let it happen the next
time they fully reopen the app.

### `virtual:pwa-register` in SSR

Not relevant here (this is a client-only SPA), but in a server-rendered app
the virtual module must only be imported on the client.

### Don't cache the banner away

Because `index.html` is precached by the worker, the `UpdatePrompt` component
itself only exists once the new app code has loaded. That's fine: the banner
is about updating *from* the current version *to a newer one*, so the current
build always contains it.

---

## 14. Glossary

| Term | Meaning |
|---|---|
| **SPA (Single Page Application)** | An app where the server sends one HTML file and JS handles all navigation. |
| **Service Worker (SW)** | A background script that intercepts network requests and can cache responses. Runs separately from the page. |
| **Scope** | The URL prefix a service worker controls. `/` = whole site. |
| **Precache** | Files a service worker downloads and stores during `install`, so they're available offline and instantly. |
| **Cache Storage** | The browser storage API the service worker uses. Distinct from the ordinary HTTP cache. |
| **Workbox** | Google's library for building service workers (precache, routing strategies). |
| **vite-plugin-pwa** | Vite plugin that generates the service worker and manifest, and wires up Workbox. |
| **Workbox Window** | The page-side helper that registers the SW and emits update events to your app. |
| **`skipWaiting()`** | Tells a waiting worker to activate immediately instead of waiting for all tabs to close. |
| **`clientsClaim()`** | Makes a newly activated worker take control of pages that are already open. |
| **`registration.update()`** | Manually asks the browser to check for a new `sw.js`. |
| **`NavigationRoute`** | Workbox route that serves a cached `index.html` for page navigations (SPA offline support). |
| **`NetworkFirst`** | Cache strategy: try the network, fall back to cache. Used for your API. |
| **`CacheFirst`** | Cache strategy: serve cache, fetch only if missing. |
| **`needRefresh`** | Boolean from `useRegisterSW` that becomes true when a new worker is waiting. |
| **`SKIP_WAITING`** | The message name workbox-window posts to activate a waiting worker. |
| **PWA** | Progressive Web App — a website with a manifest and service worker that can be installed. |
| **Manifest** | JSON file describing name, icons, colors, and display mode for installation. |

---

## Appendix: Before vs. After

### Before

```ts
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  // ...
})
```

```js
// dist/registerSW.js (injected)
navigator.serviceWorker.register('/sw.js', { scope: '/' })
```

- ❌ No update checks ever triggered by the app
- ❌ No update awareness in React
- ❌ No reload path
- ❌ `autoUpdate` gave a false sense of safety

### After

```ts
// vite.config.ts
VitePWA({
  registerType: 'prompt',
  // ...
})
```

```ts
// src/hooks/useAppUpdate.ts
useRegisterSW({ onRegisteredSW(_, r) { registrationRef.current = r } })
// + registration.update() on mount / 60s / visibilitychange / focus
```

```tsx
// src/main.tsx
<UpdatePrompt />   // "A new version is available → Refresh"
```

- ✅ App actively checks for new workers
- ✅ Foreground events cover installed mobile PWAs
- ✅ User controls when to reload
- ✅ New worker activates only on demand
- ✅ One registration path, no bare injected script