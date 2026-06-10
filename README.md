# kirigiris-press hub

Router project for the `kirigiris.press` apex domain plus the small server
side the static products can't host themselves. It owns `vercel.json` (root
redirect + per-product proxies) and the Platega donation endpoints under
`api/donate/` — this repo is the only place Platega secrets live.

## Current routes

| Path                | Behaviour                                                              |
| ------------------- | ---------------------------------------------------------------------- |
| `/`                 | 307 redirect → `/guidebook`                                            |
| `/guidebook`        | rewrite → `https://shinri-trial-guideboard.vercel.app/guidebook`       |
| `/guidebook/:path*` | rewrite → `https://shinri-trial-guideboard.vercel.app/guidebook/:path*`|

The guidebook is built with `base: '/guidebook/'`, so every asset and runtime
fetch it emits already carries the `/guidebook/` prefix. The hub forwards
matching requests verbatim — no asset-path mirroring required.

## Adding a new product

When a sibling product (e.g. `productB`) goes live:

1. Deploy the product to its own Vercel project. The project should build with
   the matching path base (e.g. Vite `base: '/productB/'`) so absolute paths it
   emits stay self-consistent.
2. Add two rewrites here:

   ```json
   { "source": "/productB",        "destination": "https://<project>.vercel.app/productB" },
   { "source": "/productB/:path*", "destination": "https://<project>.vercel.app/productB/:path*" }
   ```

3. Deploy this hub. The product is now reachable at
   `kirigiris.press/productB`. No changes to the product repo.

## Donation API (`api/donate/`)

Vercel serverless functions backing the guidebook's donation flow
(non-fiscal пожертвования, whole rubles, currency RUB). The guidebook UI is
static and calls these endpoints; payment truth always comes from a
server-side re-query of Platega — never from the unsigned callback.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/donate/create` | POST | Validates `{ amount, paymentMethod }`, generates the transaction UUID server-side, calls Platega `POST /transaction/process`, returns `{ redirect, transactionId }`. Per-IP rate-limited. |
| `/api/donate/status` | GET | `?id=<uuid>` — re-queries Platega `GET /transaction/{id}` and returns only `{ status, amount, currency }`. |
| `/api/donate/callback` | POST | Platega webhook. The callback is **unsigned**, so it is treated as a hint: the handler re-queries Platega, logs the verified lifecycle, and always answers 200 so Platega doesn't retry-storm. No ledger in v1. |

Shared helpers live in `api/_lib/` (underscore-prefixed paths are not exposed
as routes). The functions have **zero runtime npm dependencies** — Vercel
compiles the TypeScript natively, so the no-install/no-build project setup
keeps working. `devDependencies` exist only for local `pnpm typecheck` and
`pnpm test` (vitest).

### Environment variables

| Var | Purpose |
| --- | --- |
| `PLATEGA_MERCHANT_ID` | secret — Platega `X-MerchantId` header |
| `PLATEGA_SECRET` | secret — Platega `X-Secret` header |
| `PLATEGA_BASE` | optional, defaults to `https://app.platega.io` |
| `GUIDEBOOK_RETURN_BASE` | e.g. `https://kirigiris.press/guidebook` — return/failedUrl are built from this, never from client input |
| `ALLOWED_ORIGINS` | CORS allowlist, comma-separated: `https://kirigiris.press,https://shinri-trial-guidebook.vercel.app` |
| `PLATEGA_TEST_MODE` | optional `true` — `/create` skips Platega and redirects straight to the return URL; `/status` returns a canned `CONFIRMED`. Full UI flow with zero money. |

### Security invariants

1. Secrets only in env — never in responses or logs.
2. Payment truth = Platega status re-query; the unsigned callback never
   changes anything by itself.
3. All input validated server-side; client values are proposals.
4. `return`/`failedUrl` are server-constructed from `GUIDEBOOK_RETURN_BASE`.
5. CORS restricted to `ALLOWED_ORIGINS`; methods GET/POST; header
   Content-Type.
6. `/create` is rate-limited per IP (best-effort in-memory window).
7. No PII collected or stored.

### Local checks

```bash
pnpm install
pnpm typecheck
pnpm test
```

Go-live verification: one real 1 ₽ payment (Platega has no public sandbox);
confirm the dashboard shows 1.00 ₽, proving whole-ruble units.

## Deployment

- Vercel project framework preset: **Other** (no build, no install).
- `api/**/*.ts` functions are compiled and deployed by Vercel automatically;
  they need no install step because they have no runtime dependencies.
- The donation endpoints need the environment variables above set in the
  Vercel project (Production scope at minimum).
- Output directory: leave blank (Vercel serves `vercel.json` directly).
- The custom domain `kirigiris.press` (and `www.kirigiris.press`) must be
  attached to this project, not to any individual product.

## Why this design

Path-based routing under a single brand domain keeps URLs unified
(`kirigiris.press/guidebook`, `kirigiris.press/productB`) while products
deploy independently. The hub is intentionally dumb — it owns DNS and routes,
not content — so a bad deploy of any product can't take down the others.
