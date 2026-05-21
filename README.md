# kirigiris-press hub

Router project for the `kirigiris.press` apex domain. Owns no application
code — just `vercel.json`, which redirects the bare root to `/guidebook` and
proxies subpaths to per-product Vercel deployments.

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

## Analytics

This project has Vercel Web Analytics enabled to track traffic across the hub:

- **Package**: `@vercel/analytics` is installed as a dependency
- **Configuration**: Analytics are enabled via the `analytics.enable` setting in `vercel.json`
- **Fallback page**: A minimal HTML page in `public/index.html` includes the analytics script for any direct page visits
- **Dashboard**: Analytics data can be viewed in the Vercel project dashboard after deployment

**Note**: Since this is primarily a routing hub, most traffic is proxied to other applications. For comprehensive analytics across all products, ensure each proxied application (e.g., the guidebook) also has analytics configured independently.

To enable Web Analytics in the Vercel dashboard:
1. Go to your project settings
2. Navigate to the Analytics tab
3. Enable Web Analytics
4. Deploy the project

## Deployment

- Vercel project framework preset: **Other** (no build, no install).
- Output directory: leave blank (Vercel serves `vercel.json` directly).
- The custom domain `kirigiris.press` (and `www.kirigiris.press`) must be
  attached to this project, not to any individual product.

## Why this design

Path-based routing under a single brand domain keeps URLs unified
(`kirigiris.press/guidebook`, `kirigiris.press/productB`) while products
deploy independently. The hub is intentionally dumb — it owns DNS and routes,
not content — so a bad deploy of any product can't take down the others.
