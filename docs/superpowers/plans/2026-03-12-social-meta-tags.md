# Implementation Plan: Per-Route Social Meta Tags

**Spec:** `docs/superpowers/specs/2026-03-12-social-meta-tags-design.md`
**Date:** 2026-03-12

---

## Prerequisites

Before starting, update `FRONTEND_URL` in the Render dashboard for the `trampoline-backend` service from `https://trampoline-frontend.onrender.com` to `https://trampoline-backend.onrender.com` (or your custom domain). This must be set before deploying or the OG image URLs will be wrong.

---

## Step 1 — Update `frontend/public/index.html`

Replace hardcoded OG/Twitter content with placeholder tokens and fix outdated static values.

**Changes:**
- `<title>` → `<title>__OG_TITLE__</title>`
- `<meta name="description" content="...">` → remove (replaced by `__OG_DESCRIPTION_BLOCK__`)
- `<meta name="author" content="British Gymnastics">` → `content="Trampoline Life"`
- `<meta name="keywords">` → remove or replace with generic terms (no longer cheatsheet-specific)
- `<link rel="canonical" href="...">` → `href="__OG_URL__"`
- `og:url` → `content="__OG_URL__"`
- `og:title` → `content="__OG_TITLE__"`
- `og:description` → remove (part of `__OG_DESCRIPTION_BLOCK__`)
- `og:image`, `og:image:width`, `og:image:height` → remove (part of `__OG_IMAGE_BLOCK__`)
- `og:site_name` → `content="Trampoline Life"`
- `twitter:url` → `content="__OG_URL__"`
- `twitter:title` → `content="__OG_TITLE__"`
- `twitter:description` → remove (part of `__OG_DESCRIPTION_BLOCK__`)
- `twitter:image` → remove (part of `__OG_IMAGE_BLOCK__`)

**Add two block placeholder tokens** in place of the removed tags:
```html
<!-- OG description block -->
__OG_DESCRIPTION_BLOCK__

<!-- OG image block -->
__OG_IMAGE_BLOCK__
```

**Update JSON-LD block:** Replace the hardcoded URL with `__OG_URL__`.

---

## Step 2 — Update `backend/server.js`

Four sub-changes, **in this order**:

### 2a — Add `fs` require at top of file
```js
const fs = require('fs');
```
Add alongside the existing `path` require near the top.

### 2b — Disable helmet CSP
Find `app.use(helmet())` and change to:
```js
app.use(helmet({
  contentSecurityPolicy: false,
}));
```
**Why:** Helmet's default CSP blocks CRA's inlined runtime script chunk, breaking the app in the browser.

### 2c — Add `express.static` for frontend build (before API routes)
Find the comment `// API-only server` or the block where static routes are set up. Add before any API route registrations:
```js
app.use(express.static(path.join(__dirname, 'frontend', 'build')));
```
Note: `__dirname` in the container is `/app`, so this resolves to `/app/frontend/build`.

### 2d — Add catch-all route (after all API routes, replacing the "API-only" comment)
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

---

## Step 3 — Update `Dockerfile.backend`

Insert the following block **after** the canvas verification step and **before** `npx prisma generate`:

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

**Why before prisma generate:** No dependency between them; placing it here keeps build steps grouped logically.
**Why `CI=false`:** CRA treats warnings as errors when `CI=true`, which is Render's default.

---

## Step 4 — Update `render.yaml`

1. **Delete** the entire `trampoline-frontend` service block (the `type: web, runtime: static` entry).
2. **Add** `dockerBuildArgs` to the `trampoline-backend` service:

```yaml
dockerBuildArgs:
  - key: REACT_APP_API_URL
    value: https://trampoline-backend.onrender.com
  - key: CI
    value: false
```

`REACT_APP_API_URL` must be a build arg (not a runtime env var) — CRA bakes it into the JS bundle at build time.

---

## Step 5 — Create image generation script

Create `backend/scripts/generate-social-preview.js`:

```js
#!/usr/bin/env node
/**
 * Generate a 1200x630 social preview image.
 * Usage: node backend/scripts/generate-social-preview.js [--variant home|cheatsheets]
 * Output: frontend/public/social-preview.png (default)
 */

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const variantFlag = args.indexOf('--variant');
const variant = variantFlag >= 0 ? args[variantFlag + 1] : 'home';

const WIDTH = 1200;
const HEIGHT = 630;

const variants = {
  home: {
    title: 'Trampoline Life',
    subtitle: 'Gymnastics Club Management',
    outputFile: 'social-preview.png',
  },
  cheatsheets: {
    title: '2026 BG Rules',
    subtitle: 'Cheatsheets for Trampoline & DMT',
    outputFile: 'social-preview-cheatsheets.png',
  },
};

const config = variants[variant] || variants.home;

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = '#1a1a2e';
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Accent bar
ctx.fillStyle = '#e94560';
ctx.fillRect(0, HEIGHT - 12, WIDTH, 12);

// Title
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 80px DejaVu Sans';
ctx.textAlign = 'center';
ctx.fillText(config.title, WIDTH / 2, HEIGHT / 2 - 30);

// Subtitle
ctx.fillStyle = '#cccccc';
ctx.font = '40px DejaVu Sans';
ctx.fillText(config.subtitle, WIDTH / 2, HEIGHT / 2 + 50);

const outputPath = path.join(__dirname, '../../frontend/public', config.outputFile);
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);
console.log(`Written: ${outputPath}`);
```

Run with `node backend/scripts/generate-social-preview.js` to regenerate the image. Commit the output PNG to update it in production.

---

## Step 6 — Verify locally

Start the backend with `npm start` from `backend/`, pointing `FRONTEND_URL` to `http://localhost:5000`. Then:

```bash
# Check meta tags for each route
curl -s http://localhost:5000/ | grep -E "og:|twitter:|__OG"
curl -s http://localhost:5000/cheatsheets | grep -E "og:|twitter:|__OG"
curl -s http://localhost:5000/dashboard | grep -E "og:|twitter:|__OG"
```

Confirm:
- No `__OG_` tokens appear in the output (all replaced)
- `/` and `/cheatsheets` have their correct titles and image tags
- `/dashboard` has no image block and default title
- React app loads correctly in the browser (no CSP errors in console)

---

## Step 7 — Deploy and decommission

1. Push to `main` — Render will rebuild the Docker image with the frontend baked in.
2. Once confirmed working, delete the `trampoline-frontend` static service from the Render dashboard.
3. Remove `https://trampoline-frontend.onrender.com` from the CORS allowlist in `backend/server.js`.

---

## Notes

- **No local dev change needed** — the React dev server (`localhost:3000`) still proxies to the Express backend as before. Meta injection only applies to the production Express catch-all.
- **`/cheatsheets` PDF route** — the existing `express.static(cheatsheetsPath)` middleware for PDFs is unaffected. `express.static` calls `next()` when no file matches, so `/cheatsheets` (no filename) correctly falls through to the catch-all.
