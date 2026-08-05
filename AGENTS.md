<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## What this is

Cloudflare Worker running a Hono app. AT Protocol (Bluesky) OAuth login. All HTML rendered on the
server with srv-jsx (server-only JSX, native out-of-order streaming). No client framework.

## Server (`src/server.ts`) -> controllers (`src/controllers/`)

- `src/server.ts` = Worker entry (`main` in `wrangler.jsonc`). Only place the Hono app is created.
- server.ts mounts global middleware for every request:
  - `contextStorage()` — needed for `getContext()` (see below)
  - `csrf()`
  - `atcute()` from `hono-atcute` — restores AT session from signed `did` cookie; exposes
    `c.get("atcute")` (`{ session, oauth, client }`)
  - `srvJsxRenderer()` from `@/lib/renderer` — adds `c.render(<jsx>)` that streams HTML
  - `htmxRedirects()` from `@/lib/htmx` — converts 3xx to `HX-Redirect` + 204 when
    `HX-Request: true`
- Controllers: each file in `src/controllers/` creates its own `Hono` app with routes and
  default-exports it. server.ts mounts them with `app.route(prefix, app)`:
  - `app.route("", marketing)` — marketing controller handles `/`
  - `app.route("/oauth", oauth)` — oauth handles `/oauth/login`, `/oauth/logout`,
    `/oauth/callback`
- To add a route: create controller file or add to existing, mount it in server.ts. Shared middleware stays in
  server.ts, never in controllers.
- Access per-request data two ways:
  - handler arg `c` inside a route
  - `getContext()` from `hono/context-storage` inside any container/layout that needs it
- Async components that load data are called "containers"

## srv-jsx

Configured in `tsconfig.json`: `"jsx": "react-jsx"`, `"jsxImportSource": "srv-jsx"`. Vite plugin
`jsx()` in `vite.config.ts`.

Import from `srv-jsx`: `Fragment`, `Suspense`, `ErrorBoundary`, `Marker`, `renderToReadableStream`.

### Client interactivity = inline `"use client"`

Browser-only logic goes in a function body that STARTS with the string literal `"use client";`.
srv-jsx/vite compiles that function into a client reference (separate client build); server emits an
id into the HTML, browser executes the fn. Works on event props (`onclick`, `onchange`, `on*`) and
`ref` callbacks.

```tsx
<button
  onclick={(event) => {
    "use client";
    const btn = event.currentTarget as HTMLButtonElement;
    // browser-only
  }}
/>
```

- Single file cannot mix module-level `"use client"` (top of file = all exports are client refs)
  and inline directives. Inline directives cannot nest.
- `ref={async () => { "use client"; ... }}` = the on-mount hydration pattern. Used by all
  `@/components/ui/*` widgets: lazily `const api = await basecoat();`, call `api.init(...)`.
- Handlers run in browser, so they can touch `event`, `event.currentTarget`, DOM, `navigator`, etc.
- `on*` prop without `"use client"` must be strings of JS code. functions not marked `"use client"` will error.

### Client entry (`src/browser.ts`)

`index` input of the `client` build environment in vite.config.ts. Loads `htmx.org`, basecoat, and
conditional polyfills (`template-for-polyfill` for processing directives, `invokers-polyfill` for
`command`/`commandFor`). Injected by `src/components/document.tsx` `Head` via
`@hiogawa/vite-plugin-fullstack` asset merge (`serverAssets.merge(browserAssets)`).

### Progressive enhancement

Forms/links work without JS. htmx handles partial updates; `htmxRedirects()` normalizes redirects
for it. Browser UI = basecoat-css (`window.basecoat`, typings in `basecoat.d.ts`), lazy-imported via
`src/lib/basecoat.ts`. Always access window.basecoat via `const api = await basecoat();`.

## Page structure

- Controllers render a full `<html>` shell via `c.render()`.
- `src/components/document.tsx`: `Head` (anti-FOUC theme script, injects css/js modulepreloads,
  module entry script) and `Body` (mounts `<Toaster>`, reads `?error=` query params into error
  toasts).
- Layouts in `src/containers/` (e.g. `marketing-layout.tsx`) wrap page children. They call
  `getContext()` to read request state (is user logged in, their profile) and render auth UI
  (login dialog form -> `POST /oauth/login`; logged-in dropdown -> `POST /oauth/logout`).

## OAuth / AT protocol

- Login flow in `src/controllers/oauth.ts`:
  - `POST /login` — validate `handle` input with valibot schema, call `atcute.oauth.authorize`, redirect.
  - `GET /callback` — `atcute.oauth.callback`, fetch profile via `AppBskyActorGetProfile`
    (`@atcute/bluesky` lexicons), store in `Profile` DO, `setSessionDid(c, did)` sets the signed cookie.
  - `POST /logout` — `clearSessionDid(c)`, `session.signOut()`, redirect.
- `c.get("atcute").session?.did` tells you the logged-in did. Use `c.get("atcute").authenticated`, or the existence of `c.get("atcute").session` or `c.get("atcute").client` to gate authenticated UI.

## Durable Objects / storage

- Declared in `wrangler.jsonc`: bindings + `migrations` tags. Accessible as `c.env.<NAME>`.
- `src/models/profile.ts`: `Profile` DurableObject. Uses a valibot schema to validate every
  read/write; persists via `ctx.storage`. `getByName(did).get()` / `.set(...)`.
- `AtprotoStore` (from `hono-atcute/cloudflare`) backs OAuth sessions/stores.

## Paths / aliases

- `@/*` -> `./src/*`. Defined in `tsconfig.json` and `vite.config.ts` (`tsconfigPaths`).

## File map

| Path                | Role                                                          |
| ------------------- | ------------------------------------------------------------- |
| `src/server.ts`     | Worker entry; Hono app; global middleware; mounts controllers |
| `src/controllers/*` | Route modules (self-contained Hono apps)                      |
| `src/containers/*`  | Page layouts                                                  |
| `src/components/*`  | Reusable JSX: document, ui/* widgets, theme-toggle            |
| `src/lib/*`         | renderer, htmx, basecoat, clsx, view-transition               |
| `src/models/*`      | Durable Object storage models                                 |
| `src/browser.ts`    | Client entrypoint (htmx, basecoat, polyfills)                 |
| `src/styles.css`    | Tailwind + basecoat entry                                     |
| `wrangler.jsonc`    | Worker main, durable objects, bindings, migrations            |

## Rules I follow

- Add routes as controllers; mount from server.ts.
- Server-render JSX by default. Browser only via inline `"use client"` handlers/refs.
- Validate all untrusted input with a valibot schema (form input, `Profile` reads/writes).
- React-jargon trap: this is srv-jsx, not React. `on*`/`ref` client fns, server components, no hooks.
