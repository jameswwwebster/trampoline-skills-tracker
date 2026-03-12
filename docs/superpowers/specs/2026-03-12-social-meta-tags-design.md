# Design: Per-Route Social Meta Tags (OG/Twitter)

**Date:** 2026-03-12
**Status:** Approved

---

## Problem

The app currently uses a static `index.html` served by Render's static site service. All OG/Twitter meta tags are the same for every URL — currently hardcoded to `/cheatsheets` content. Social media crawlers don't execute JavaScript, so client-side meta tag changes (react-helmet) don't help.

## Solution

Move the frontend to be served by the Express backend. The backend reads `index.html`, injects route-specific meta tags via string replacement, then sends the modified HTML. Static assets (JS, CSS, images) are still served directly via `express.static`.

---

## Route Meta Tag Config

A config object in the backend maps URL paths to OG metadata:

| Path | Title | Description | Image |
|------|-------|-------------|-------|
| `/` | Trampoline Life — Gymnastics Club Management | Manage your gymnastics club — bookings, members, sessions and more. | `social-preview.png` |
| `/cheatsheets` | 2026 BG Rules Cheatsheets - Trampoline & DMT \| British Gymnastics | One-page cheatsheets for trampoline and DMT requirements for British Gymnastics competitions in the UK — 2026 rules, regulations and qualification pathways | `social-preview.png` |
| *(fallback)* | Trampoline Life | *(omitted)* | *(omitted)* |

The base URL for image and URL tags is derived from the `FRONTEND_URL` environment variable (already present in the backend env), e.g. `https://trampoline-backend.onrender.com`.

`social-preview.png` is confirmed to be in `frontend/public/`, so CRA will copy it to `frontend/build/` and it will be served correctly by `express.static`.

---

## Changes

### 1. `frontend/public/index.html`

Replace hardcoded OG/Twitter content with placeholder tokens. The template should reflect what a generic "no meta" state looks like, with route-specific content injected by the server.

Tokens:
- `__OG_TITLE__` — og:title, twitter:title, and `<title>`
- `__OG_URL__` — og:url, twitter:url, canonical href, and the URL in the JSON-LD block
- `__OG_IMAGE_BLOCK__` — replaced with the full og:image + twitter:image tag block when an image applies, or an **empty string** when it doesn't. This avoids emitting `content=""` on image tags, which is invalid OG markup.
- `__OG_DESCRIPTION_BLOCK__` — replaced with the full description meta tag block (og:description, twitter:description, meta description) when a description applies, or an **empty string** when it doesn't. Same reason — empty description tags are poor practice.

**og:site_name** is updated from the hardcoded "British Gymnastics Cheatsheets" to the fixed value "Trampoline Life".

**twitter:title** note: the existing template uses a slightly shorter twitter title (without "| British Gymnastics"). After this change, `__OG_TITLE__` will be used for both og:title and twitter:title, so they will be identical. This is a minor behaviour change.

**JSON-LD block:** The existing `<script type="application/ld+json">` block contains hardcoded `/cheatsheets` URLs. Replace the URL values within it with `__OG_URL__` so the injected URL is correct per-route. The name and description fields in the JSON-LD block remain as generic site-level values rather than per-route values.

### 2. `backend/server.js`

**Path to frontend build:** `server.js` lives at `/app/server.js` in the container (after `COPY backend/ .`). The frontend is built into `/app/frontend/build`. All `path.join` calls use `path.join(__dirname, 'frontend', 'build')` — **not** `path.join(__dirname, '..', 'frontend', 'build')`.

**`fs` require:** Add `const fs = require('fs');` at the top of the file alongside the existing `path` require. Do not add it inline in the catch-all handler.

**helmet CSP:** The existing `app.use(helmet())` call uses default settings, which enable a Content-Security-Policy that will block the React app's script bundles when served via Express. The CRA production build inlines a small runtime script chunk in `index.html`. Before adding frontend serving, disable helmet's CSP:

```js
app.use(helmet({
  contentSecurityPolicy: false,
}));
```

**Before all API routes**, add:

```js
// Serve frontend static assets (JS, CSS, images, etc.)
app.use(express.static(path.join(__dirname, 'frontend', 'build')));
```

**Note on existing `/cheatsheets` static middleware:** `app.use('/cheatsheets', express.static(cheatsheetsPath))` serves PDF files from `resources/requirement-cheatsheets/`. `express.static` calls `next()` when no file matches — it does NOT send a 404. A bare GET to `/cheatsheets` (no filename) will not match any file in that directory and will fall through to the catch-all correctly.

**After all API routes** (replacing the "API-only" comment), add a catch-all:

```js
const ogMeta = {
  '/': {
    title: 'Trampoline Life — Gymnastics Club Management',
    description: 'Manage your gymnastics club — bookings, members, sessions and more.',
    image: true,
  },
  '/cheatsheets': {
    title: '2026 BG Rules Cheatsheets - Trampoline & DMT | British Gymnastics',
    description: 'One-page cheatsheets for trampoline and DMT requirements for British Gymnastics competitions in the UK — 2026 rules, regulations and qualification pathways',
    image: true,
  },
};

app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'frontend', 'build', 'index.html');

  // Fail loudly if frontend build is missing — indicates a broken deployment
  let html = fs.readFileSync(indexPath, 'utf8');

  const meta = ogMeta[req.path] || {};
  const baseUrl = process.env.FRONTEND_URL || `https://${req.get('host')}`;
  const currentUrl = `${baseUrl}${req.path}`;

  const imageBlock = meta.image
    ? `<meta property="og:image" content="${baseUrl}/social-preview.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:image" content="${baseUrl}/social-preview.png" />`
    : '';

  const descriptionBlock = meta.description
    ? `<meta name="description" content="${meta.description}" />
    <meta property="og:description" content="${meta.description}" />
    <meta name="twitter:description" content="${meta.description}" />`
    : '';

  html = html
    .replace(/__OG_TITLE__/g, meta.title || 'Trampoline Life')
    .replace(/__OG_URL__/g, currentUrl)
    .replace(/__OG_IMAGE_BLOCK__/g, imageBlock)
    .replace(/__OG_DESCRIPTION_BLOCK__/g, descriptionBlock);

  res.send(html);
});
```

`FRONTEND_URL` is already set as an env var on the backend Render service, ensuring the image URL is always `https://...` rather than trusting `req.protocol` (unreliable behind Render's load balancer with `trust proxy: false`).

Missing `index.html` (e.g. failed Docker build) throws synchronously and is caught by Express's error handler, returning a 500. This is the correct failure mode — fail loudly rather than silently.

### 3. `Dockerfile.backend`

Add a frontend build stage. Frontend files are copied to `/app/frontend/` so the build output lands at `/app/frontend/build`.

The `CI=false` env var must be set **inside Docker** (not just in Render's env vars) to suppress Create React App's warnings-as-errors during `npm run build`. Add it via `ARG` + `ENV` alongside `REACT_APP_API_URL`:

```dockerfile
# Build frontend
ARG REACT_APP_API_URL
ARG CI=false
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV CI=$CI

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build
```

Insert this block after the `npm rebuild canvas` and canvas verification steps, before `npx prisma generate`.

**Note on `REACT_APP_API_URL`:** Several frontend files use `process.env.REACT_APP_API_URL || 'http://localhost:5000'`. The `||` fallback means an empty string would fall through to localhost. Set `REACT_APP_API_URL` to the full backend URL (e.g. `https://trampoline-backend.onrender.com`), not an empty string.

### 4. `render.yaml`

- Remove the `trampoline-frontend` static service entry entirely.
- Add the following to the `trampoline-backend` service:

```yaml
dockerBuildArgs:
  - key: REACT_APP_API_URL
    value: https://trampoline-backend.onrender.com
  - key: CI
    value: false
```

Note: `REACT_APP_API_URL` must be a **Docker build arg** (`dockerBuildArgs`), not a runtime env var. CRA bakes env vars into the JS bundle at build time; a runtime env var has no effect on an already-built bundle.

`FRONTEND_URL` is already present as a runtime env var — ensure it is set to the backend's public URL (same service now).

---

## Image Generation Script

A standalone Node script (`backend/scripts/generate-social-preview.js`) using the existing `canvas` dependency to generate a 1200×630 PNG. Output goes to `frontend/public/social-preview.png`. Run locally and commit the PNG to update the image.

The existing `social-preview.png` is already committed and will continue to be used as-is. The script is the mechanism for generating a replacement or additional per-route images in future.

The script accepts a `--variant` flag for generating route-specific images in future (e.g. `--variant cheatsheets`, `--variant home`), though initially both routes share the same image.

---

## Deployment Considerations

- **URL change:** Frontend will now be served from `trampoline-backend.onrender.com`. Any custom domain (e.g. `booking.trampoline.life`) should remain pointing at the backend service — no DNS change needed if it already points there.
- **`FRONTEND_URL` env var:** Currently set to `https://trampoline-frontend.onrender.com` in the Render dashboard. **Must be updated** to `https://trampoline-backend.onrender.com` (or the custom domain) before deploying, otherwise OG image and URL tags will point to the old frontend domain.
- **CORS:** The `trampoline-frontend.onrender.com` origin in the CORS allowlist in `server.js` can be removed once the static service is decommissioned.
- **Trailing slashes / sub-routes:** `ogMeta[req.path]` does exact-path matching. `/cheatsheets/` (trailing slash) or `/cheatsheets/foo` will fall through to the generic fallback (no image, default title). This is acceptable.
- **`author` and `keywords` meta tags:** The existing `index.html` has `<meta name="author" content="British Gymnastics">` and cheatsheet-specific keywords. These are out of scope but the implementer should update `author` to "Trampoline Life" and clean up `keywords` while editing the file.
- **Performance:** `express.static` serves assets with caching headers. The catch-all uses `fs.readFileSync` — acceptable for infrequent crawler hits; can be cached in memory if needed later.
- **Local dev:** No change. The React dev server (`localhost:3000`) still proxies API calls to `localhost:5000`. Meta injection only applies in production.
