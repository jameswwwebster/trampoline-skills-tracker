# Public Website Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public-facing homepage (`/`) and club policies page (`/policies`) to the existing React app, replacing the Wix site at trampoline.life.

**Architecture:** Two new public React routes added before the auth-protected layout routes in App.js. All pages share the existing design system (CSS variables, Exo 2 font) via a new `public.css`. All content is static — no API calls. Mobile-first responsive design throughout.

**Tech Stack:** React 18, React Router v6, existing CSS custom properties (`--secondary-color: #7c35e8`, `--font-family: 'Exo 2'`), Google Maps embed iframe.

**Spec:** `docs/superpowers/specs/2026-03-11-public-website-design.md`

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `frontend/src/App.js` | Modify | Add public routes before protected routes; update PageMeta |
| `frontend/src/pages/public/public.css` | Create | Public-site layout styles using existing CSS vars |
| `frontend/src/pages/public/PublicNav.js` | Create | Nav with brand, links, social icons, CTA |
| `frontend/src/pages/public/PublicFooter.js` | Create | Footer with copyright and social links |
| `frontend/src/pages/public/PublicHome.js` | Create | Full homepage — all sections |
| `frontend/src/pages/public/PublicPolicies.js` | Create | Club policies page — 5 sections |
| `frontend/src/pages/public/__tests__/PublicNav.test.js` | Create | Nav render + link tests |
| `frontend/src/pages/public/__tests__/PublicHome.test.js` | Create | Homepage smoke test + key content |
| `frontend/src/pages/public/__tests__/PublicPolicies.test.js` | Create | Policies page smoke test + section headings |

---

## Chunk 1: Foundation — Routing, Nav, Footer, CSS

### Task 1: Routing + skeleton components

Adds the two public routes to App.js and creates empty skeleton files so the routes resolve without errors.

**Files:**
- Modify: `frontend/src/App.js`
- Create: `frontend/src/pages/public/PublicHome.js`
- Create: `frontend/src/pages/public/PublicPolicies.js`
- Create: `frontend/src/pages/public/public.css`

**Context:**
Currently `App.js` has `<Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>` with `<Route index element={<Navigate to="/booking" replace />} />`. Navigating to `/` as a logged-out user redirects to `/login`. We want `/` and `/policies` to be publicly accessible without authentication.

In React Router v6, add the public routes **before** the protected layout route. Because the public `<Route path="/" element={<PublicHome />} />` has no children, React Router scores it as a more specific match for exactly `/` than the layout route's index child. For `/policies`, it's a distinct path that won't conflict.

- [ ] **Step 1: Create the public directory and empty skeleton files**

```bash
mkdir -p frontend/src/pages/public/__tests__
```

Create `frontend/src/pages/public/public.css` — empty for now (will be filled in Task 2):

```css
/* Public website styles — uses existing CSS custom properties from App.css */
```

Create `frontend/src/pages/public/PublicHome.js`:

```jsx
import React from 'react';
import './public.css';

export default function PublicHome() {
  return <div className="public-page"><p>Homepage coming soon</p></div>;
}
```

Create `frontend/src/pages/public/PublicPolicies.js`:

```jsx
import React from 'react';
import './public.css';

export default function PublicPolicies() {
  return <div className="public-page"><p>Policies coming soon</p></div>;
}
```

- [ ] **Step 2: Write the routing test first**

Create `frontend/src/pages/public/__tests__/PublicHome.test.js`:

```jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicHome from '../PublicHome';

test('renders skeleton placeholder text', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByText(/Homepage coming soon/i)).toBeInTheDocument();
});
```

Create `frontend/src/pages/public/__tests__/PublicPolicies.test.js`:

```jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicPolicies from '../PublicPolicies';

test('renders skeleton placeholder text', () => {
  render(<MemoryRouter><PublicPolicies /></MemoryRouter>);
  expect(screen.getByText(/Policies coming soon/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests — expect PASS (skeleton renders)**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="pages/public"
```

Expected: 2 tests pass.

- [ ] **Step 4: Add public routes to App.js**

Add imports near the top of `frontend/src/App.js` (after the existing imports):

```jsx
import PublicHome from './pages/public/PublicHome';
import PublicPolicies from './pages/public/PublicPolicies';
```

In the `<Routes>` block inside `AppContent`, add two public routes **before** the `<Route path="/login" ...>` line:

```jsx
{/* Public website routes — no authentication required */}
<Route path="/" element={<PublicHome />} />
<Route path="/policies" element={<PublicPolicies />} />
```

No change needed to `PageMeta` — the existing `else` block already sets `document.title = 'Trampoline Life'` which is correct for the public pages.

- [ ] **Step 5: Verify routes work manually**

Start the dev server:

```bash
cd frontend && npm start
```

- Navigate to `http://localhost:3000/` — should show "Homepage coming soon" without redirecting to `/login`
- Navigate to `http://localhost:3000/policies` — should show "Policies coming soon"
- Navigate to `http://localhost:3000/booking` — should still redirect to `/login` (protected)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.js frontend/src/pages/public/
git commit -m "feat: add public routes for homepage and policies"
```

---

### Task 2: PublicNav + PublicFooter + public.css

Builds the shared navigation and footer used by both public pages, and fills in the CSS foundation.

**Files:**
- Create: `frontend/src/pages/public/PublicNav.js`
- Create: `frontend/src/pages/public/PublicFooter.js`
- Modify: `frontend/src/pages/public/public.css`
- Create: `frontend/src/pages/public/__tests__/PublicNav.test.js`

**Context:**
- Existing CSS vars: `--secondary-color: #7c35e8` (purple), `--font-family: 'Exo 2', Arial, sans-serif`
- Nav: dark background `#1a1a2e`, brand left, links centre, social icons + CTA right
- Social platforms: Instagram, TikTok, Facebook, WhatsApp (URLs are placeholders — each is a `const` at the top of the file so they're easy to update)
- CTA button: "Book a session" → links to `/booking`
- Mobile: nav collapses, show hamburger menu
- The social icons use inline SVG paths (brand icons from SimpleIcons)

- [ ] **Step 1: Write the nav test first**

Create `frontend/src/pages/public/__tests__/PublicNav.test.js`:

```jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicNav from '../PublicNav';

test('renders brand name', () => {
  render(<MemoryRouter><PublicNav /></MemoryRouter>);
  expect(screen.getByText('Trampoline Life')).toBeInTheDocument();
});

test('renders Sessions link', () => {
  render(<MemoryRouter><PublicNav /></MemoryRouter>);
  expect(screen.getByText('Sessions')).toBeInTheDocument();
});

test('renders Policies link', () => {
  render(<MemoryRouter><PublicNav /></MemoryRouter>);
  expect(screen.getByText('Policies')).toBeInTheDocument();
});

test('renders Book a session button', () => {
  render(<MemoryRouter><PublicNav /></MemoryRouter>);
  expect(screen.getByText('Book a session')).toBeInTheDocument();
});

test('renders Shop link', () => {
  render(<MemoryRouter><PublicNav /></MemoryRouter>);
  expect(screen.getByText('Shop')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="PublicNav"
```

Expected: FAIL — `PublicNav` not yet created.

- [ ] **Step 3: Create PublicNav.js**

Create `frontend/src/pages/public/PublicNav.js`:

```jsx
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

// Social media profile URLs — update these before go-live
const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/',
  tiktok: 'https://www.tiktok.com/',
  facebook: 'https://www.facebook.com/',
  whatsapp: 'https://wa.me/',
};

// Kit shop URL — update before go-live
const SHOP_URL = 'https://shop.sumup.com/';

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export default function PublicNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  const isHome = pathname === '/';

  return (
    <nav className="pub-nav">
      <div className="pub-nav-inner">
        <Link to="/" className="pub-nav-brand">Trampoline Life</Link>

        {/* Desktop links */}
        <div className="pub-nav-links">
          <a href={isHome ? '#sessions' : '/#sessions'} className="pub-nav-link">Sessions</a>
          <Link to="/policies" className="pub-nav-link">Policies</Link>
          <a href={SHOP_URL} target="_blank" rel="noopener noreferrer" className="pub-nav-link">Shop</a>
          <a
            href={SOCIAL_LINKS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="pub-nav-social"
            aria-label="Instagram"
          >
            <InstagramIcon />
          </a>
          <a
            href={SOCIAL_LINKS.tiktok}
            target="_blank"
            rel="noopener noreferrer"
            className="pub-nav-social"
            aria-label="TikTok"
          >
            <TikTokIcon />
          </a>
          <a
            href={SOCIAL_LINKS.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="pub-nav-social"
            aria-label="Facebook"
          >
            <FacebookIcon />
          </a>
          <a
            href={SOCIAL_LINKS.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="pub-nav-social"
            aria-label="WhatsApp"
          >
            <WhatsAppIcon />
          </a>
          <a href="/booking" className="pub-nav-cta">Book a session</a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="pub-nav-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="pub-nav-mobile" onClick={() => setMenuOpen(false)}>
          <a href={isHome ? '#sessions' : '/#sessions'} className="pub-nav-mobile-link">Sessions</a>
          <Link to="/policies" className="pub-nav-mobile-link">Policies</Link>
          <a href={SHOP_URL} target="_blank" rel="noopener noreferrer" className="pub-nav-mobile-link">Shop</a>
          <div className="pub-nav-mobile-social">
            <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><InstagramIcon /></a>
            <a href={SOCIAL_LINKS.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok"><TikTokIcon /></a>
            <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><FacebookIcon /></a>
            <a href={SOCIAL_LINKS.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><WhatsAppIcon /></a>
          </div>
          <a href="/booking" className="pub-nav-cta" style={{ margin: '0.5rem 1rem' }}>Book a session</a>
        </div>
      )}
    </nav>
  );
}
```

- [ ] **Step 4: Create PublicFooter.js**

Create `frontend/src/pages/public/PublicFooter.js`:

```jsx
import React from 'react';

const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/',
  tiktok: 'https://www.tiktok.com/',
  facebook: 'https://www.facebook.com/',
  whatsapp: 'https://wa.me/',
};

export default function PublicFooter() {
  return (
    <footer className="pub-footer">
      <div className="pub-footer-inner">
        <span>© {new Date().getFullYear()} Trampoline Life</span>
        <div className="pub-footer-links">
          <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href={SOCIAL_LINKS.tiktok} target="_blank" rel="noopener noreferrer">TikTok</a>
          <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>
          <a href={SOCIAL_LINKS.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Fill in public.css**

Replace contents of `frontend/src/pages/public/public.css`:

```css
/* ─── Public site foundation ───────────────────────────────────────────── */
.public-page {
  font-family: var(--font-family);
  color: var(--text-color);
  min-height: 100vh;
  min-width: 320px;
  display: flex;
  flex-direction: column;
}

/* ─── Nav ───────────────────────────────────────────────────────────────── */
.pub-nav {
  background: #1a1a2e;
  position: sticky;
  top: 0;
  z-index: 100;
}

.pub-nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pub-nav-brand {
  color: #fff;
  font-weight: 700;
  font-size: 1.1rem;
  text-decoration: none;
  white-space: nowrap;
}

.pub-nav-links {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.pub-nav-link {
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.15s;
}
.pub-nav-link:hover { color: #fff; }

.pub-nav-social {
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  transition: color 0.15s;
}
.pub-nav-social:hover { color: var(--secondary-color); }

.pub-nav-cta {
  background: var(--secondary-color);
  color: #fff;
  padding: 0.45rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.pub-nav-cta:hover { opacity: 0.9; }

/* Hamburger — hidden on desktop */
.pub-nav-hamburger {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
}
.pub-nav-hamburger span {
  display: block;
  width: 22px;
  height: 2px;
  background: #fff;
  border-radius: 2px;
}

/* Mobile menu */
.pub-nav-mobile {
  display: none;
  flex-direction: column;
  background: #1a1a2e;
  padding: 0.5rem 0 1rem;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.pub-nav-mobile-link {
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  padding: 0.75rem 1.25rem;
  font-size: 0.95rem;
}
.pub-nav-mobile-link:hover { color: #fff; }

.pub-nav-mobile-social {
  display: flex;
  gap: 1.25rem;
  padding: 0.75rem 1.25rem;
  color: rgba(255, 255, 255, 0.85);
}
.pub-nav-mobile-social a {
  color: rgba(255, 255, 255, 0.85);
  display: flex;
}
.pub-nav-mobile-social a:hover { color: var(--secondary-color); }

/* ─── Footer ───────────────────────────────────────────────────────────── */
.pub-footer {
  background: #1a1a2e;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.82rem;
  margin-top: auto;
}

.pub-footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.25rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.pub-footer-links {
  display: flex;
  gap: 1.25rem;
}

.pub-footer-links a {
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  transition: color 0.15s;
}
.pub-footer-links a:hover { color: #fff; }

/* ─── Section common ────────────────────────────────────────────────────── */
.pub-section {
  padding: 4rem 1rem;
}

.pub-section-inner {
  max-width: 1000px;
  margin: 0 auto;
}

.pub-section-title {
  font-size: clamp(1.5rem, 4vw, 2.2rem);
  font-weight: 800;
  margin: 0 0 1.5rem;
  color: var(--text-color);
}

/* ─── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .pub-nav-links { display: none; }
  .pub-nav-hamburger { display: flex; }
  .pub-nav-mobile { display: flex; }

  .pub-footer-inner { flex-direction: column; text-align: center; }
  .pub-footer-links { justify-content: center; flex-wrap: wrap; }
}
```

- [ ] **Step 6: Run nav tests — expect PASS**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="PublicNav"
```

Expected: 5 tests pass.

- [ ] **Step 7: Wire PublicNav and PublicFooter into skeleton pages**

Update `frontend/src/pages/public/PublicHome.js`:

```jsx
import React from 'react';
import PublicNav from './PublicNav';
import PublicFooter from './PublicFooter';
import './public.css';

export default function PublicHome() {
  return (
    <div className="public-page">
      <PublicNav />
      <main style={{ flex: 1 }}>
        <p style={{ padding: '2rem' }}>Homepage coming soon</p>
      </main>
      <PublicFooter />
    </div>
  );
}
```

Update `frontend/src/pages/public/PublicPolicies.js`:

```jsx
import React from 'react';
import PublicNav from './PublicNav';
import PublicFooter from './PublicFooter';
import './public.css';

export default function PublicPolicies() {
  return (
    <div className="public-page">
      <PublicNav />
      <main style={{ flex: 1 }}>
        <p style={{ padding: '2rem' }}>Policies coming soon</p>
      </main>
      <PublicFooter />
    </div>
  );
}
```

- [ ] **Step 8: Run all public tests**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="pages/public"
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/public/
git commit -m "feat: add PublicNav, PublicFooter, and public.css"
```

---

## Chunk 2: Homepage Sections

### Task 3: Hero section

**Files:**
- Modify: `frontend/src/pages/public/PublicHome.js`
- Modify: `frontend/src/pages/public/public.css`

**Context:**
- Hero uses a background image from the Wix CDN with a dark overlay
- Headline: "The only trampoline and DMT club in Newcastle" — the words "trampoline" and "DMT" are `<span>` elements styled in `var(--secondary-color)` (#7c35e8)
- Body copy below headline
- "Book a session" CTA button linking to `/booking`

- [ ] **Step 1: Write hero content test**

Add to `frontend/src/pages/public/__tests__/PublicHome.test.js`:

```jsx
test('renders hero headline', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByText(/The only/i)).toBeInTheDocument();
  expect(screen.getByText(/club in Newcastle/i)).toBeInTheDocument();
});

test('renders Book a session CTA', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  const ctaLinks = screen.getAllByText('Book a session');
  expect(ctaLinks.length).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="PublicHome"
```

Expected: FAIL — hero content not yet present.

- [ ] **Step 3: Add hero section to PublicHome.js**

Update `frontend/src/pages/public/PublicHome.js`:

```jsx
import React from 'react';
import PublicNav from './PublicNav';
import PublicFooter from './PublicFooter';
import './public.css';

const HERO_IMAGE = 'https://static.wixstatic.com/media/010c39_6310c1e27ecf44e199e0055176fcbb5a~mv2.png/v1/crop/x_0,y_9,w_1080,h_383,q_90,enc_avif,quality_auto/010c39_6310c1e27ecf44e199e0055176fcbb5a~mv2.png';

export default function PublicHome() {
  return (
    <div className="public-page">
      <PublicNav />
      <main>
        {/* Hero */}
        <section className="pub-hero" style={{ backgroundImage: `url(${HERO_IMAGE})` }}>
          <div className="pub-hero-overlay">
            <div className="pub-hero-content">
              <h1 className="pub-hero-headline">
                The only <span className="pub-accent">trampoline</span> and <span className="pub-accent">DMT</span> club in Newcastle
              </h1>
              <p className="pub-hero-body">
                Trampoline Life offers recreational and competitive Trampoline and DMT training
                from qualified coaches in a safe environment. Come along and try it out for
                yourselves; young or old, everybody is welcome!
              </p>
              <a href="/booking" className="pub-hero-cta">Book a session</a>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
```

- [ ] **Step 4: Add hero CSS to public.css**

Append to `frontend/src/pages/public/public.css`:

```css
/* ─── Hero ──────────────────────────────────────────────────────────────── */
.pub-hero {
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  min-height: 420px;
  display: flex;
}

.pub-hero-overlay {
  width: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
}

.pub-hero-content {
  max-width: 720px;
  text-align: center;
  color: #fff;
}

.pub-hero-headline {
  font-size: clamp(1.8rem, 5vw, 3rem);
  font-weight: 800;
  margin: 0 0 1rem;
  line-height: 1.2;
  color: #fff;
}

.pub-accent {
  color: var(--secondary-color);
}

.pub-hero-body {
  font-size: clamp(1rem, 2.5vw, 1.15rem);
  opacity: 0.9;
  margin: 0 0 2rem;
  line-height: 1.6;
}

.pub-hero-cta {
  display: inline-block;
  background: var(--secondary-color);
  color: #fff;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  text-decoration: none;
  transition: opacity 0.15s;
}
.pub-hero-cta:hover { opacity: 0.9; }
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="PublicHome"
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/public/PublicHome.js frontend/src/pages/public/public.css
git commit -m "feat: add hero section to homepage"
```

---

### Task 4: Session Information section

**Files:**
- Modify: `frontend/src/pages/public/PublicHome.js`
- Modify: `frontend/src/pages/public/public.css`

**Context:**
- Dark background section matching the original Wix design (#1a1a2e or very dark)
- "£6 per hour" in purple, "Age 5+", description text, then 3-column day grid
- The booking link in paragraph 2 points to `/booking`
- Day grid: Tuesday (5–6pm, 6–7pm), Wednesday (5–6pm, 6–7pm), Thursday (5–6pm, 6–7pm, (16+ only) 7–8pm)
- Add `id="sessions"` so the nav "Sessions" anchor link works

- [ ] **Step 1: Write sessions content test**

Add to `frontend/src/pages/public/__tests__/PublicHome.test.js`:

```jsx
test('renders Session Information heading', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByText('Session Information')).toBeInTheDocument();
});

test('renders £6 per hour', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByText(/£6 per hour/i)).toBeInTheDocument();
});

test('renders Tuesday session times', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByText('Tuesday')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="PublicHome"
```

- [ ] **Step 3: Add session section to PublicHome.js**

Add the sessions section inside `<main>`, after the hero:

```jsx
{/* Session Information */}
<section id="sessions" className="pub-sessions">
  <div className="pub-sessions-inner">
    <h2 className="pub-sessions-title">Session Information</h2>
    <h3 className="pub-sessions-subtitle">Trampoline and DMT</h3>
    <p className="pub-sessions-price">£6 per hour</p>
    <p className="pub-sessions-age">Age 5+</p>
    <p className="pub-sessions-body">
      Our recreation sessions are suitable for all ages and abilities and concentrate on
      developing beginner trampoline skills. Coaching is provided but there is a period where
      participants will be expected to practice the skills on their own. It's best if attendees
      have a degree of independence.
    </p>
    <p className="pub-sessions-body">
      Since the spaces in our sessions are limited we ask that people book in advance using our{' '}
      <a href="/booking" className="pub-sessions-link">booking system</a>. These sessions are
      first come first serve.
    </p>
    <div className="pub-sessions-grid">
      <div className="pub-sessions-day">
        <h4>Tuesday</h4>
        <p>5–6pm</p>
        <p>6–7pm</p>
      </div>
      <div className="pub-sessions-day">
        <h4>Wednesday</h4>
        <p>5–6pm</p>
        <p>6–7pm</p>
      </div>
      <div className="pub-sessions-day">
        <h4>Thursday</h4>
        <p>5–6pm</p>
        <p>6–7pm</p>
        <p>(16+ only) 7–8pm</p>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 4: Add sessions CSS to public.css**

```css
/* ─── Sessions ──────────────────────────────────────────────────────────── */
.pub-sessions {
  background: #1a1a2e;
  color: #fff;
  padding: 4rem 1rem;
  text-align: center;
}

.pub-sessions-inner {
  max-width: 900px;
  margin: 0 auto;
}

.pub-sessions-title {
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  font-weight: 800;
  margin: 0 0 0.5rem;
  color: #fff;
}

.pub-sessions-subtitle {
  font-size: clamp(1.1rem, 2.5vw, 1.4rem);
  font-weight: 700;
  margin: 0 0 0.75rem;
  color: #fff;
}

.pub-sessions-price {
  font-size: clamp(1.6rem, 4vw, 2.2rem);
  font-weight: 800;
  color: var(--secondary-color);
  margin: 0 0 0.25rem;
}

.pub-sessions-age {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 1.5rem;
  opacity: 0.85;
}

.pub-sessions-body {
  font-size: 0.95rem;
  line-height: 1.7;
  opacity: 0.85;
  margin: 0 0 1rem;
  text-align: left;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
}

.pub-sessions-link {
  color: var(--secondary-color);
  text-decoration: underline;
}

.pub-sessions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin-top: 2.5rem;
  text-align: center;
}

.pub-sessions-day h4 {
  font-size: clamp(1.2rem, 3vw, 1.6rem);
  font-weight: 800;
  margin: 0 0 0.5rem;
  color: #fff;
}

.pub-sessions-day p {
  font-size: 0.95rem;
  opacity: 0.85;
  margin: 0.2rem 0;
}

@media (max-width: 600px) {
  .pub-sessions-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="PublicHome"
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/public/PublicHome.js frontend/src/pages/public/public.css
git commit -m "feat: add session information section to homepage"
```

---

### Task 5: Welfare Officer + Sponsors + Contact sections

**Files:**
- Modify: `frontend/src/pages/public/PublicHome.js`
- Modify: `frontend/src/pages/public/public.css`

**Context:**
- Welfare Officer: Wendy's photo (Wix CDN URL), name "Wendy", title "Welfare Officer", phone as `tel:` link
- Sponsors: British Engines logo (Wix CDN URL), links to britishengines.com
- Contact: address (Sport@Kenton, Kenton Lane, NE3 3RU), email as `mailto:` link, Google Maps embed
- For the Google Map, use a query-based embed (no API key required):
  `https://maps.google.com/maps?q=Sport+at+Kenton,+Kenton+Lane,+Newcastle,+NE3+3RU&output=embed`

- [ ] **Step 1: Write content tests**

Add to `frontend/src/pages/public/__tests__/PublicHome.test.js`:

```jsx
test('renders Welfare Officer section', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByText('Welfare Officer')).toBeInTheDocument();
  expect(screen.getByText('Wendy')).toBeInTheDocument();
});

test('renders sponsors section', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByAltText('British Engines')).toBeInTheDocument();
});

test('renders contact address', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByText(/Kenton Lane/i)).toBeInTheDocument();
  expect(screen.getByText(/contact@trampoline.life/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="PublicHome"
```

- [ ] **Step 3: Add three sections to PublicHome.js**

Add after the sessions section, inside `<main>`:

```jsx
{/* Welfare Officer */}
<section className="pub-section pub-welfare">
  <div className="pub-section-inner pub-welfare-inner">
    <img
      src="https://static.wixstatic.com/media/010c39_0dc74357e2cb4848806f93e84723d3b6~mv2.jpg/v1/fill/w_632,h_632,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/010c39_0dc74357e2cb4848806f93e84723d3b6~mv2.jpg"
      alt="Wendy — Welfare Officer"
      className="pub-welfare-photo"
    />
    <div className="pub-welfare-info">
      <p className="pub-welfare-title">Welfare Officer</p>
      <h2 className="pub-welfare-name">Wendy</h2>
      <a href="tel:07761185480" className="pub-welfare-phone">07761 185480</a>
    </div>
  </div>
</section>

{/* Sponsors */}
<section className="pub-section pub-sponsors">
  <div className="pub-section-inner">
    <h2 className="pub-section-title" style={{ textAlign: 'center' }}>Our Sponsors</h2>
    <div className="pub-sponsors-list">
      <a
        href="https://www.britishengines.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="pub-sponsor-link"
      >
        <img
          src="https://static.wixstatic.com/media/010c39_504658f1638c4a6283d58ff8a756e724~mv2.jpg/v1/fill/w_340,h_340,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/329757191_1482935178903653_4558575537921607617_n_jpg__nc_cat%3D110%26ccb%3D1-7%26_nc_sid%3D6ee11a%26_n.jpg"
          alt="British Engines"
          className="pub-sponsor-logo"
        />
      </a>
    </div>
  </div>
</section>

{/* Contact */}
<section className="pub-section pub-contact">
  <div className="pub-section-inner">
    <h2 className="pub-section-title">Contact Us</h2>
    <div className="pub-contact-grid">
      <div className="pub-contact-details">
        <div className="pub-contact-item">
          <p className="pub-contact-label">Address</p>
          <address className="pub-contact-address">
            Sport@Kenton<br />
            Kenton Lane<br />
            NE3 3RU
          </address>
        </div>
        <div className="pub-contact-item">
          <p className="pub-contact-label">Email</p>
          <a href="mailto:contact@trampoline.life" className="pub-contact-email">
            contact@trampoline.life
          </a>
        </div>
      </div>
      <div className="pub-contact-map">
        <iframe
          title="Trampoline Life location"
          src="https://maps.google.com/maps?q=Sport+at+Kenton,+Kenton+Lane,+Newcastle,+NE3+3RU&output=embed"
          width="100%"
          height="300"
          style={{ border: 0, borderRadius: '8px' }}
          allowFullScreen=""
          loading="lazy"
        />
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 4: Add CSS for the three sections**

```css
/* ─── Welfare Officer ────────────────────────────────────────────────────── */
.pub-welfare {
  background: #f8f8ff;
}

.pub-welfare-inner {
  display: flex;
  align-items: center;
  gap: 2.5rem;
}

.pub-welfare-photo {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 4px solid var(--secondary-color);
}

.pub-welfare-title {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--secondary-color);
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.pub-welfare-name {
  font-size: clamp(1.4rem, 3vw, 1.8rem);
  font-weight: 800;
  margin: 0 0 0.5rem;
}

.pub-welfare-phone {
  color: var(--text-color);
  font-size: 1rem;
  text-decoration: none;
  font-weight: 600;
}
.pub-welfare-phone:hover { color: var(--secondary-color); }

@media (max-width: 600px) {
  .pub-welfare-inner {
    flex-direction: column;
    text-align: center;
  }
}

/* ─── Sponsors ──────────────────────────────────────────────────────────── */
.pub-sponsors {
  background: #fff;
  border-top: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
}

.pub-sponsors-list {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 2rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.pub-sponsor-link {
  display: block;
}

.pub-sponsor-logo {
  max-height: 80px;
  width: auto;
  opacity: 0.85;
  transition: opacity 0.15s;
}
.pub-sponsor-logo:hover { opacity: 1; }

/* ─── Contact ───────────────────────────────────────────────────────────── */
.pub-contact {
  background: #f8f8ff;
}

.pub-contact-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 2.5rem;
  align-items: start;
}

.pub-contact-item {
  margin-bottom: 1.5rem;
}

.pub-contact-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--secondary-color);
  font-weight: 600;
  margin: 0 0 0.4rem;
}

.pub-contact-address {
  font-style: normal;
  line-height: 1.7;
  color: var(--text-color);
}

.pub-contact-email {
  color: var(--text-color);
  text-decoration: none;
  font-weight: 500;
}
.pub-contact-email:hover { color: var(--secondary-color); }

.pub-contact-map {
  border-radius: 8px;
  overflow: hidden;
}
.pub-contact-map iframe {
  display: block;
}

@media (max-width: 768px) {
  .pub-contact-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="PublicHome"
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/public/PublicHome.js frontend/src/pages/public/public.css
git commit -m "feat: add welfare officer, sponsors, and contact sections"
```

---

## Chunk 3: Policies Page

### Task 6: Policies page — five sections

**Files:**
- Modify: `frontend/src/pages/public/PublicPolicies.js`
- Modify: `frontend/src/pages/public/public.css`

**Context:**
- Five sections, all open by default (no accordion)
- Photography section: "SportMember" replaced with "your account on this site"
- Other Policies: BG statement + list of external links (open in new tab)

- [ ] **Step 1: Write policies tests**

Replace contents of `frontend/src/pages/public/__tests__/PublicPolicies.test.js`:

```jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicPolicies from '../PublicPolicies';

test('renders all five section headings', () => {
  render(<MemoryRouter><PublicPolicies /></MemoryRouter>);
  expect(screen.getByText('Coaches')).toBeInTheDocument();
  expect(screen.getByText('Participants')).toBeInTheDocument();
  expect(screen.getByText('Parents & Guardians')).toBeInTheDocument();
  expect(screen.getByText('Photography')).toBeInTheDocument();
  expect(screen.getByText('Other Policies')).toBeInTheDocument();
});

test('photography section references "your account on this site"', () => {
  render(<MemoryRouter><PublicPolicies /></MemoryRouter>);
  expect(screen.getByText(/your account on this site/i)).toBeInTheDocument();
});

test('other policies has BG links', () => {
  render(<MemoryRouter><PublicPolicies /></MemoryRouter>);
  expect(screen.getByText(/British Gymnastics/i)).toBeInTheDocument();
  expect(screen.getByText(/Privacy Policy/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="PublicPolicies"
```

- [ ] **Step 3: Implement PublicPolicies.js**

Replace contents of `frontend/src/pages/public/PublicPolicies.js`:

```jsx
import React from 'react';
import PublicNav from './PublicNav';
import PublicFooter from './PublicFooter';
import './public.css';

const BG_LINKS = [
  { label: 'Health, Safety and Welfare Policy', url: 'http://www.bg-insurance.org/Resources/Health-Safety-Welfare-Policy' },
  { label: 'Equality Policy', url: 'http://www.bg-insurance.org/Resources/Equality-Policy' },
  { label: 'Safeguarding and Protecting Children Policy', url: 'http://www.bg-insurance.org/Resources/Safeguarding-Protecting-Children-Policy' },
  { label: 'Anti-Doping Guidance', url: 'https://www.british-gymnastics.org/technical-information/performance-gymnastics/anti-doping' },
  { label: 'Jewellery, Body Piercing & Adornments Policy', url: 'http://www.bg-insurance.org/Resources/Jewellery-Body-Piercing-Adornments-Policy' },
  { label: 'Younger Persons Guide to Working Together', url: 'https://cdn3.british-gymnastics.org/images/safeguarding/20170522-Younger_persons_guide_to_Working_Together_2015.pdf' },
  { label: 'Good Practice Guidelines on the Use of Social Networking Sites', url: 'https://www.british-gymnastics.org/clubs/club-membership/document-downloads/safeguarding-compliance/welfare-officer-support/3466-bg-good-practice-guidelines-on-the-use-of-social-networking-sites/file' },
  { label: 'Safeguarding Children - Safe Environment', url: 'https://www.british-gymnastics.org/documents/departments/membership/safeguarding-compliance/safeguarding-and-protecting-children/7769-safeguarding-children-safe-environment-06-2016/file' },
  { label: 'Safeguarding Children - Recognising & Responding to Abuse & Poor Practice', url: 'https://www.british-gymnastics.org/coaching/coach-membership/document-downloads/safeguarding-compliance/safeguarding-and-protecting-children/5726-safeguarding-children-abuse-poor-practice/file' },
  { label: 'Safeguarding Children - Safe Recruitment', url: 'https://www.british-gymnastics.org/coaching/coach-membership/document-downloads/safeguarding-compliance/safeguarding-and-protecting-children/5723-safeguarding-children-safe-recruitment/file' },
  { label: 'Health, Safety and Welfare Guidance - Safe Trips', url: 'https://www.british-gymnastics.org/about-us-documents/7982-h-s-guidance-safe-trips/file' },
  { label: 'Safe Coaching', url: 'https://www.british-gymnastics.org/about-us-documents/7980-h-s-guidance-safe-coaching/file' },
  { label: 'Live Streaming Policy', url: 'https://www.trampoline.life/_files/ugd/010c39_c655cd31a8474713816f220a1571328e.pdf' },
  { label: 'Privacy Policy', url: 'https://www.trampoline.life/_files/ugd/010c39_8149752e3d6d4e8da8152830870077aa.pdf' },
];

export default function PublicPolicies() {
  return (
    <div className="public-page">
      <PublicNav />
      <main className="pub-policies-main">
        <div className="pub-policies-inner">
          <h1 className="pub-policies-page-title">Club Policies</h1>

          <section className="pub-policy-section">
            <h2>Coaches</h2>
            <p className="pub-policy-intro">Coaches and other club officials are expected to:</p>
            <ul>
              <li>Consider the welfare of participants before the development of performance.</li>
              <li>Develop an appropriate working relationship with performers based on mutual trust and respect.</li>
              <li>Hold appropriate, valid qualifications and insurance cover.</li>
              <li>Make sure all activities are suitable for the performers age, ability and experience and that the gymnast is both physically and psychologically prepared.</li>
              <li>Display consistent high standards of behaviour, dress and language.</li>
              <li>Obtain parental permission for all extracurricular activities (e.g. club bowling trip).</li>
              <li>Promote fair play and good sportsmanship.</li>
              <li>Never have performers stay overnight at your home.</li>
              <li>Immediately report any incidences of any kind of abuse.</li>
              <li>Never condone violence or the use of prohibited substances.</li>
            </ul>
          </section>

          <section className="pub-policy-section">
            <h2>Participants</h2>
            <p className="pub-policy-intro">All participants are expected to:</p>
            <ul>
              <li>Respect coaches and other club officials and their decisions.</li>
              <li>Keep to agreed timings for training and competitions or inform their coach if circumstances change.</li>
              <li>Inform the coaches of any illness or injury that would affect performance.</li>
              <li>Treat equipment and facilities with respect.</li>
              <li>Wear suitable attire for training. Long hair should be tied back and all jewellery removed.</li>
              <li>Pay any fees for training or events promptly.</li>
              <li>Refrain from smoking, consuming alcohol or other substances whilst representing the club.</li>
              <li>Respect fellow members and treat each other with dignity. Discrimination, bullying and other inappropriate behaviour will not be tolerated.</li>
              <li>Minors should remain with coaches at the end of a session until collected by their parent or guardian.</li>
            </ul>
          </section>

          <section className="pub-policy-section">
            <h2>Parents &amp; Guardians</h2>
            <p className="pub-policy-intro">Parents and Guardians are expected to:</p>
            <ul>
              <li>Encourage your child to participate without forcing them to take part.</li>
              <li>Help your child to recognise good individual performance, not just competition results.</li>
              <li>Lead by example in showing good sportsmanship and applauding all good performances.</li>
              <li>Ensure your child is dressed appropriately for the activity and has plenty to drink.</li>
              <li>Ensure coaches are aware of any illness or injury that may affect training.</li>
              <li>Use correct and proper language at all times.</li>
              <li>Never punish or belittle a child for poor performance or making mistakes.</li>
              <li>We request that parents remain nearby if your child is aged 8 or younger.</li>
              <li>Always collect your child promptly at the end of a session. If your child will be collected by somebody who does not normally pick them up, please make sure the coach in charge of the session is aware of this.</li>
              <li>If you wish to raise a concern about any aspect of the club procedures or regarding a specific incident please contact the Welfare Officer (contact details on the home page).</li>
            </ul>
          </section>

          <section className="pub-policy-section">
            <h2>Photography</h2>
            <ul>
              <li>No photography or video recording equipment including photo and video imaging phones may be used during training sessions.</li>
              <li>Coaches and other club officials may employ photography or videos on occasion for the purposes of promoting the club or as a coaching aid. You will be given the chance to opt out of this via your account on this site.</li>
              <li>Please be aware that competition venues may have their own photography and imagery policies.</li>
              <li>Imagery posted to social media may mention first names, but we will not tag minors in posts.</li>
            </ul>
          </section>

          <section className="pub-policy-section">
            <h2>Other Policies</h2>
            <p>
              Trampoline Life abides by British Gymnastics policies. Should you have any queries
              regarding policies, or concerns about welfare issues please contact the Club Welfare
              Officer.
            </p>
            <h3 className="pub-policy-subheading">British Gymnastics Policies</h3>
            <ul className="pub-policy-links">
              {BG_LINKS.map(({ label, url }) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer">{label}</a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
```

- [ ] **Step 4: Add policies CSS to public.css**

```css
/* ─── Policies page ─────────────────────────────────────────────────────── */
.pub-policies-main {
  flex: 1;
  background: #fff;
}

.pub-policies-inner {
  max-width: 800px;
  margin: 0 auto;
  padding: 3rem 1.5rem;
}

.pub-policies-page-title {
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  font-weight: 800;
  margin: 0 0 2.5rem;
  color: var(--text-color);
}

.pub-policy-section {
  margin-bottom: 3rem;
  padding-bottom: 3rem;
  border-bottom: 1px solid #eee;
}
.pub-policy-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.pub-policy-section h2 {
  font-size: clamp(1.2rem, 2.5vw, 1.5rem);
  font-weight: 800;
  color: var(--secondary-color);
  margin: 0 0 0.75rem;
}

.pub-policy-intro {
  font-weight: 600;
  margin: 0 0 0.75rem;
}

.pub-policy-section ul {
  margin: 0;
  padding-left: 1.5rem;
}

.pub-policy-section li {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}

.pub-policy-subheading {
  font-size: 1rem;
  font-weight: 700;
  margin: 1.25rem 0 0.75rem;
  color: var(--text-color);
}

.pub-policy-links li {
  margin-bottom: 0.5rem;
}

.pub-policy-links a {
  color: var(--secondary-color);
  text-decoration: none;
}
.pub-policy-links a:hover {
  text-decoration: underline;
}
```

- [ ] **Step 5: Run all public tests**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="pages/public"
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/public/PublicPolicies.js frontend/src/pages/public/public.css
git commit -m "feat: add club policies page"
```

---

## Final verification

- [ ] Start the dev server and visually check all pages:

```bash
cd frontend && npm start
```

- `http://localhost:3000/` — homepage with hero, sessions, welfare officer, sponsors, contact
- `http://localhost:3000/policies` — all 5 policy sections visible
- Resize browser to mobile width (≤ 375px) — nav collapses to hamburger, sections stack single column
- `http://localhost:3000/booking` — still redirects to login (protected route unaffected)

- [ ] Run full test suite

```bash
cd frontend && npx react-scripts test --watchAll=false
```

Expected: all tests pass, no regressions.

- [ ] Push to remote

```bash
git push
```
