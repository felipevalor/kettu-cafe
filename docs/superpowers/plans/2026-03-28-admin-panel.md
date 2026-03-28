# Admin Panel — Kettu Café Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/admin` panel that lets the café owner manage menu items (CRUD) with JWT auth and D1 storage, while making the public menu dynamic.

**Architecture:** Cloudflare Pages Functions (`functions/api/[[path]].js`) serve all `/api/*` routes on the same domain as the Pages site — no CORS, no second domain. The admin SPA lives in `public/admin/`. The public landing page fetches menu items dynamically instead of hardcoding them.

**Tech Stack:** Vanilla JS, Cloudflare Pages + Pages Functions, Cloudflare D1 (SQLite), Web Crypto API (SHA-256, HMAC-SHA256 for auth — no npm deps)

---

## ⚠️ Deployment Model Note

This plan uses **Cloudflare Pages Functions** (`functions/api/[[path]].js`) instead of the separate `worker/index.js`. Pages Functions run on the same domain as the Pages site, so the frontend can call `/api/*` as relative URLs. The existing `worker/index.js` is kept but superseded; do not delete it.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `migrations/002_menu_and_users.sql` | CREATE | DB schema: `users` + `menu_items` tables + seed data |
| `functions/api/[[path]].js` | CREATE | All API routes: auth, menu CRUD, admin CRUD |
| `.dev.vars` | CREATE | Local `SECRET_KEY` env var (gitignored) |
| `public/index.html` | MODIFY | Remove hardcoded `<div class="product-card">` elements |
| `public/js/main.js` | MODIFY | Add `loadMenu()` — `fetch('/api/menu')` + render cards |
| `public/admin/index.html` | CREATE | Admin SPA shell: setup/login/dashboard views + modal |
| `public/admin/admin.css` | CREATE | Dark-theme admin styles matching site palette |
| `public/admin/admin.js` | CREATE | Auth flow + CRUD + modal logic |

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/002_menu_and_users.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- migrations/002_menu_and_users.sql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK(category IN ('cafe', 'pastry', 'brunch')),
  title TEXT NOT NULL,
  description TEXT,
  price TEXT NOT NULL,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed: migrate existing hardcoded items from index.html
INSERT INTO menu_items (category, title, description, price, image_url, sort_order) VALUES
  ('cafe',   'Flat White',        'Doble shot de espresso con leche texturizada artesanalmente.', '$3200', '/img/latte.jpg',    1),
  ('pastry', 'Croissant Clásico', 'Laminado a mano, 72hs de fermentación.',                      '$1800', '/img/flatt.jpg',    1),
  ('brunch', 'Avocado Toast',     'Pan de campo, palta fresca, tomates confitados y mix de semillas.', '$4500', '/img/tostadas.jpg', 1);
```

- [ ] **Step 2: Apply migration locally**

```bash
npx wrangler d1 migrations apply kettu-cafe-db --local
```

Expected output:
```
Migrations to be applied:
  - 002_menu_and_users
✅ Applied 1 migration
```

- [ ] **Step 3: Verify tables exist**

```bash
npx wrangler d1 execute kettu-cafe-db --local --command "SELECT * FROM menu_items;"
```

Expected: 3 rows (Flat White, Croissant Clásico, Avocado Toast)

- [ ] **Step 4: Commit**

```bash
git add migrations/002_menu_and_users.sql
git commit -m "feat(db): add menu_items and users tables with seed data"
```

---

## Task 2: Environment Setup + API Function Scaffold

**Files:**
- Create: `.dev.vars`
- Create: `functions/api/[[path]].js` (scaffold only — all routes return 404 except a health check)

- [ ] **Step 1: Create `.dev.vars` for local development**

```bash
# .dev.vars — local secrets for wrangler pages dev
# This file is already in .gitignore (node_modules/ covers it — but add explicitly)
```

Create the file at `.dev.vars`:
```
SECRET_KEY=kettu-dev-secret-key-change-in-production-min32chars
```

Then add it to `.gitignore`:
```bash
echo ".dev.vars" >> .gitignore
```

- [ ] **Step 2: Create the Pages Function scaffold**

Create `functions/api/[[path]].js`:

```javascript
/**
 * Kettu Café — Pages Function API
 * All /api/* routes. Replaces worker/index.js for Pages-integrated routing.
 *
 * Routes:
 *   GET  /api/admin/check         — public: { hasUsers: boolean }
 *   POST /api/admin/setup         — public: create first admin (only if no users)
 *   POST /api/admin/login         — public: returns JWT
 *   GET  /api/menu                — public: list menu items
 *   GET  /api/admin/items         — protected: list all items
 *   POST /api/admin/items         — protected: create item
 *   PUT  /api/admin/items/:id     — protected: update item
 *   DELETE /api/admin/items/:id   — protected: delete item
 */

// ── Crypto helpers ────────────────────────────────────────────────────────────

/** Generate a random 16-byte hex salt */
function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 hash of (password + salt), returns hex string */
async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(password + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sign a JWT with HMAC-SHA256.
 * @param {object} payload  — e.g. { sub: 1, exp: unixSeconds }
 * @param {string} secret   — SECRET_KEY env var
 * @returns {string} signed JWT string
 */
async function signJWT(payload, secret) {
  const enc = (obj) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const header = enc({ alg: 'HS256', typ: 'JWT' });
  const body   = enc(payload);
  const data   = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const encodedSig = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${data}.${encodedSig}`;
}

/**
 * Verify a JWT. Returns decoded payload or null if invalid/expired.
 * @param {string} token
 * @param {string} secret
 * @returns {object|null}
 */
async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, sig] = parts;
  const data = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );

  const sigBytes = Uint8Array.from(
    atob(sig.replace(/-/g, '+').replace(/_/g, '/')),
    c => c.charCodeAt(0)
  );

  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
  if (!valid) return null;

  const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
  if (payload.exp < Date.now() / 1000) return null;

  return payload;
}

/**
 * Extract and verify JWT from Authorization header.
 * Returns decoded payload or null.
 */
async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  return verifyJWT(token, env.SECRET_KEY);
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleCheck(env, cors) {
  const { results } = await env.DB.prepare('SELECT COUNT(*) as count FROM users').all();
  const hasUsers = results[0].count > 0;
  return json({ hasUsers }, 200, cors);
}

async function handleSetup(request, env, cors) {
  const { results } = await env.DB.prepare('SELECT COUNT(*) as count FROM users').all();
  if (results[0].count > 0) {
    return json({ error: 'setup_already_done' }, 409, cors);
  }

  const { username, password } = await request.json();
  if (!username || !password || password.length < 8) {
    return json({ error: 'username and password (min 8 chars) required' }, 400, cors);
  }

  const salt = generateSalt();
  const hash = await hashPassword(password, salt);

  await env.DB.prepare(
    'INSERT INTO users (username, password_hash, password_salt) VALUES (?, ?, ?)'
  ).bind(username, hash, salt).run();

  return json({ success: true }, 201, cors);
}

async function handleLogin(request, env, cors) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return json({ error: 'missing_fields' }, 400, cors);
  }

  const { results } = await env.DB.prepare(
    'SELECT id, password_hash, password_salt FROM users WHERE username = ?'
  ).bind(username).all();

  if (results.length === 0) {
    return json({ error: 'invalid_credentials' }, 401, cors);
  }

  const user = results[0];
  const hash = await hashPassword(password, user.password_salt);

  if (hash !== user.password_hash) {
    return json({ error: 'invalid_credentials' }, 401, cors);
  }

  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days
  const token = await signJWT({ sub: user.id, exp }, env.SECRET_KEY);

  return json({ token }, 200, cors);
}

async function handleGetMenu(env, cors) {
  const { results } = await env.DB.prepare(
    'SELECT id, category, title, description, price, image_url FROM menu_items ORDER BY category, sort_order, id'
  ).all();
  return json({ items: results }, 200, cors);
}

async function handleGetAdminItems(request, env, cors) {
  const user = await requireAuth(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401, cors);

  const { results } = await env.DB.prepare(
    'SELECT * FROM menu_items ORDER BY category, sort_order, id'
  ).all();
  return json({ items: results }, 200, cors);
}

async function handleCreateItem(request, env, cors) {
  const user = await requireAuth(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401, cors);

  const { category, title, description, price, image_url, sort_order } = await request.json();
  if (!category || !title || !price) {
    return json({ error: 'category, title, and price are required' }, 400, cors);
  }
  if (!['cafe', 'pastry', 'brunch'].includes(category)) {
    return json({ error: 'category must be cafe, pastry, or brunch' }, 400, cors);
  }

  const result = await env.DB.prepare(
    'INSERT INTO menu_items (category, title, description, price, image_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(category, title, description || '', price, image_url || '', sort_order || 0).run();

  return json({ id: result.meta.last_row_id }, 201, cors);
}

async function handleUpdateItem(request, env, id, cors) {
  const user = await requireAuth(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401, cors);

  const { category, title, description, price, image_url, sort_order } = await request.json();
  if (!category || !title || !price) {
    return json({ error: 'category, title, and price are required' }, 400, cors);
  }
  if (!['cafe', 'pastry', 'brunch'].includes(category)) {
    return json({ error: 'category must be cafe, pastry, or brunch' }, 400, cors);
  }

  await env.DB.prepare(
    `UPDATE menu_items
     SET category=?, title=?, description=?, price=?, image_url=?, sort_order=?,
         updated_at=CURRENT_TIMESTAMP
     WHERE id=?`
  ).bind(category, title, description || '', price, image_url || '', sort_order || 0, id).run();

  return json({ success: true }, 200, cors);
}

async function handleDeleteItem(request, env, id, cors) {
  const user = await requireAuth(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401, cors);

  await env.DB.prepare('DELETE FROM menu_items WHERE id = ?').bind(id).run();
  return json({ success: true }, 200, cors);
}

// ── Utility ───────────────────────────────────────────────────────────────────

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const p = url.pathname;

    if (p === '/api/admin/check'  && request.method === 'GET')    return handleCheck(env, cors);
    if (p === '/api/admin/setup'  && request.method === 'POST')   return handleSetup(request, env, cors);
    if (p === '/api/admin/login'  && request.method === 'POST')   return handleLogin(request, env, cors);
    if (p === '/api/menu'         && request.method === 'GET')    return handleGetMenu(env, cors);
    if (p === '/api/admin/items'  && request.method === 'GET')    return handleGetAdminItems(request, env, cors);
    if (p === '/api/admin/items'  && request.method === 'POST')   return handleCreateItem(request, env, cors);

    const itemMatch = p.match(/^\/api\/admin\/items\/(\d+)$/);
    if (itemMatch) {
      const id = itemMatch[1];
      if (request.method === 'PUT')    return handleUpdateItem(request, env, id, cors);
      if (request.method === 'DELETE') return handleDeleteItem(request, env, id, cors);
    }

    return new Response('Not Found', { status: 404 });
  } catch (err) {
    return json({ error: 'server_error', details: err.message }, 500, cors);
  }
}
```

- [ ] **Step 3: Verify Pages Function syntax is correct**

```bash
npx wrangler pages dev public --local
```

Visit `http://localhost:8788/api/admin/check` in browser or curl:
```bash
curl http://localhost:8788/api/admin/check
```

Expected: `{"hasUsers":false}`

- [ ] **Step 4: Commit**

```bash
git add functions/api/\[\[path\]\].js .dev.vars .gitignore
git commit -m "feat(api): add Pages Function with all admin + menu endpoints"
```

---

## Task 3: Test All API Endpoints

**Files:** No changes — manual verification with curl.

> Start dev server: `npx wrangler pages dev public --local`
> All curls use `http://localhost:8788`

- [ ] **Step 1: Test check endpoint (no users yet)**

```bash
curl http://localhost:8788/api/admin/check
```
Expected: `{"hasUsers":false}`

- [ ] **Step 2: Test setup creates first admin**

```bash
curl -X POST http://localhost:8788/api/admin/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"kettu2026"}'
```
Expected: `{"success":true}` with status 201

- [ ] **Step 3: Test check shows users exist**

```bash
curl http://localhost:8788/api/admin/check
```
Expected: `{"hasUsers":true}`

- [ ] **Step 4: Test setup is blocked (second run)**

```bash
curl -X POST http://localhost:8788/api/admin/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin2","password":"another123"}'
```
Expected: `{"error":"setup_already_done"}` with status 409

- [ ] **Step 5: Test login returns JWT**

```bash
curl -X POST http://localhost:8788/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"kettu2026"}'
```
Expected: `{"token":"eyJ..."}` — copy this token for the next steps

Set the token in a shell variable:
```bash
TOKEN=$(curl -s -X POST http://localhost:8788/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"kettu2026"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo $TOKEN
```

- [ ] **Step 6: Test wrong password returns 401**

```bash
curl -X POST http://localhost:8788/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrongpass"}'
```
Expected: `{"error":"invalid_credentials"}` with status 401

- [ ] **Step 7: Test public menu endpoint**

```bash
curl http://localhost:8788/api/menu
```
Expected: `{"items":[...]}` with the 3 seeded items

- [ ] **Step 8: Test admin items endpoint (protected)**

```bash
# Without token — should fail
curl http://localhost:8788/api/admin/items
# Expected: {"error":"unauthorized"} with status 401

# With token — should succeed
curl http://localhost:8788/api/admin/items \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"items":[...]} with all 3 items
```

- [ ] **Step 9: Test create item**

```bash
curl -X POST http://localhost:8788/api/admin/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category":"cafe","title":"Cappuccino","description":"Espresso con espuma sedosa.","price":"$2800","image_url":"/img/latte.jpg","sort_order":2}'
```
Expected: `{"id":4}` (or next available id)

- [ ] **Step 10: Test update item**

```bash
# Update item id=1 (Flat White)
curl -X PUT http://localhost:8788/api/admin/items/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category":"cafe","title":"Flat White XL","description":"Version grande, doble ración.","price":"$4200","image_url":"/img/latte.jpg","sort_order":1}'
```
Expected: `{"success":true}`

- [ ] **Step 11: Test delete item**

```bash
# Delete the Cappuccino we just created (adjust id if different)
curl -X DELETE http://localhost:8788/api/admin/items/4 \
  -H "Authorization: Bearer $TOKEN"
```
Expected: `{"success":true}`

- [ ] **Step 12: Verify final state**

```bash
curl http://localhost:8788/api/menu
```
Expected: 3 items, with "Flat White XL" instead of "Flat White"

- [ ] **Step 13: Reset test data (restore Flat White)**

```bash
curl -X PUT http://localhost:8788/api/admin/items/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category":"cafe","title":"Flat White","description":"Doble shot de espresso con leche texturizada artesanalmente.","price":"$3200","image_url":"/img/latte.jpg","sort_order":1}'
```

- [ ] **Step 14: Commit (no code changes — just confirmation tests passed)**

```bash
git commit --allow-empty -m "test(api): all endpoints verified manually"
```

---

## Task 4: Dynamic Menu on Landing Page

**Files:**
- Modify: `public/index.html` (lines 81-113 — remove hardcoded product cards)
- Modify: `public/js/main.js` (add `loadMenu()` function)

- [ ] **Step 1: Remove hardcoded product cards from `public/index.html`**

Replace the three `<div class="menu-grid ...">` content blocks. The wrappers stay; their children are removed:

```html
<!-- BEFORE (lines 81-113): -->
<div class="menu-grid active" id="coffee" role="tabpanel" aria-labelledby="tab-coffee">
    <div class="product-card featured">
        <img src="img/latte.jpg" alt="Café Latte Art" loading="lazy">
        <div class="product-info">
            <h3>Flat White</h3>
            <p>Doble shot de espresso con leche texturizada artesanalmente.</p>
            <span class="price">$3200</span>
        </div>
    </div>
    <!-- More coffee items -->
</div>

<div class="menu-grid" id="pastry" role="tabpanel" aria-labelledby="tab-pastry">
    <div class="product-card">
        <img src="img/flatt.jpg" alt="Croissant Clásico artesanal" loading="lazy">
        <div class="product-info">
            <h3>Croissant Clásico</h3>
            <p>Laminado a mano, 72hs de fermentación.</p>
            <span class="price">$1800</span>
        </div>
    </div>
</div>

<div class="menu-grid" id="brunch" role="tabpanel" aria-labelledby="tab-brunch">
    <div class="product-card featured">
        <img src="img/tostadas.jpg" alt="Avocado Toast Premium" loading="lazy">
        <div class="product-info">
            <h3>Avocado Toast</h3>
            <p>Pan de campo, palta fresca, tomates confitados y mix de semillas.</p>
            <span class="price">$4500</span>
        </div>
    </div>
</div>
```

```html
<!-- AFTER: empty wrappers — JS will populate them -->
<div class="menu-grid active" id="coffee" role="tabpanel" aria-labelledby="tab-coffee"></div>
<div class="menu-grid" id="pastry" role="tabpanel" aria-labelledby="tab-pastry"></div>
<div class="menu-grid" id="brunch" role="tabpanel" aria-labelledby="tab-brunch"></div>
```

- [ ] **Step 2: Add `loadMenu()` to `public/js/main.js`**

Add this block **inside** the `DOMContentLoaded` callback, **before** the tab logic (so cards exist when IntersectionObserver attaches):

```javascript
    // 0. Load menu items dynamically from API
    const CATEGORY_TO_GRID = { cafe: 'coffee', pastry: 'pastry', brunch: 'brunch' };

    async function loadMenu() {
        try {
            const res = await fetch('/api/menu');
            if (!res.ok) return;
            const { items } = await res.json();

            items.forEach(item => {
                const gridId = CATEGORY_TO_GRID[item.category];
                const grid = document.getElementById(gridId);
                if (!grid) return;

                const card = document.createElement('div');
                card.className = 'product-card revealed';
                card.innerHTML = `
                    ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy">` : ''}
                    <div class="product-info">
                        <h3>${escapeHtml(item.title)}</h3>
                        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
                        <span class="price">${escapeHtml(item.price)}</span>
                    </div>
                `;
                grid.appendChild(card);
            });
        } catch (e) {
            console.error('Failed to load menu:', e);
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    loadMenu();
```

- [ ] **Step 3: Verify the landing page loads menu from API**

With dev server running (`npx wrangler pages dev public --local`):

1. Open `http://localhost:8788` in browser
2. Open DevTools → Network tab
3. Reload the page
4. Verify request to `/api/menu` appears and returns 200
5. Verify 3 cards appear in the "Nuestra Propuesta" section (Café, Pastelería, Brunch tabs)

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/js/main.js
git commit -m "feat(landing): load menu dynamically from /api/menu"
```

---

## Task 5: Admin Panel HTML Structure

**Files:**
- Create: `public/admin/index.html`

- [ ] **Step 1: Create the admin HTML with three views and a modal**

Create `public/admin/index.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin — Kettu Café</title>
    <link rel="icon" type="image/svg+xml" href="../img/logo-kettu.svg">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="admin.css">
</head>
<body>

<!-- ── View: Setup (first-run) ── -->
<div id="view-setup" class="view hidden">
    <div class="auth-card">
        <div class="auth-logo">
            <img src="../img/logo-kettu.svg" alt="Kettu Café">
        </div>
        <h1 class="auth-title">Configuración inicial</h1>
        <p class="auth-subtitle">Creá tu usuario administrador</p>
        <form id="form-setup" autocomplete="off">
            <label for="setup-username">Usuario</label>
            <input type="text" id="setup-username" placeholder="admin" autocomplete="username" required>
            <label for="setup-password">Contraseña <span class="hint">(mín. 8 caracteres)</span></label>
            <input type="password" id="setup-password" placeholder="••••••••" autocomplete="new-password" required minlength="8">
            <button type="submit" class="btn-primary" id="btn-setup">Crear cuenta</button>
            <p id="setup-error" class="error-msg hidden"></p>
        </form>
    </div>
</div>

<!-- ── View: Login ── -->
<div id="view-login" class="view hidden">
    <div class="auth-card">
        <div class="auth-logo">
            <img src="../img/logo-kettu.svg" alt="Kettu Café">
        </div>
        <h1 class="auth-title">Bienvenido</h1>
        <p class="auth-subtitle">Ingresá a tu panel</p>
        <form id="form-login" autocomplete="on">
            <label for="login-username">Usuario</label>
            <input type="text" id="login-username" placeholder="admin" autocomplete="username" required>
            <label for="login-password">Contraseña</label>
            <input type="password" id="login-password" placeholder="••••••••" autocomplete="current-password" required>
            <button type="submit" class="btn-primary" id="btn-login">Entrar</button>
            <p id="login-error" class="error-msg hidden"></p>
        </form>
    </div>
</div>

<!-- ── View: Dashboard ── -->
<div id="view-dashboard" class="view hidden">
    <header class="admin-header">
        <div class="admin-header-inner">
            <div class="admin-logo">
                <img src="../img/logo-kettu.svg" alt="Kettu Café">
                <span>Nuestra Propuesta</span>
            </div>
            <div class="admin-header-actions">
                <button class="btn-primary" id="btn-new">+ Agregar item</button>
                <button class="btn-ghost" id="btn-logout">Salir</button>
            </div>
        </div>
    </header>

    <main class="admin-main">
        <div class="tabs" role="tablist">
            <button class="tab active" data-tab="cafe"   role="tab" aria-selected="true">☕ Café</button>
            <button class="tab"        data-tab="pastry" role="tab" aria-selected="false">🥐 Pastelería</button>
            <button class="tab"        data-tab="brunch" role="tab" aria-selected="false">🍳 Brunch</button>
        </div>

        <div id="admin-grid" class="admin-grid">
            <!-- Cards rendered by admin.js -->
        </div>

        <p id="grid-empty" class="empty-state hidden">
            No hay items en esta categoría.<br>Hacé clic en "+ Agregar item" para crear uno.
        </p>
    </main>
</div>

<!-- ── Modal: Edit / Create ── -->
<div id="modal-overlay" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-card">
        <div class="modal-header">
            <h2 id="modal-title">Nuevo item</h2>
            <button class="modal-close" id="btn-modal-close" aria-label="Cerrar">✕</button>
        </div>
        <form id="form-item" autocomplete="off">
            <input type="hidden" id="item-id">

            <label for="item-category">Categoría</label>
            <select id="item-category" required>
                <option value="cafe">☕ Café</option>
                <option value="pastry">🥐 Pastelería</option>
                <option value="brunch">🍳 Brunch</option>
            </select>

            <label for="item-title">Nombre del producto</label>
            <input type="text" id="item-title" placeholder="Flat White" required>

            <label for="item-description">Descripción</label>
            <textarea id="item-description" placeholder="Doble shot de espresso..." rows="3"></textarea>

            <label for="item-price">Precio</label>
            <input type="text" id="item-price" placeholder="$3200" required>

            <label for="item-image">URL de la foto</label>
            <input type="url" id="item-image" placeholder="https://...">
            <p class="field-hint">Pegá un link directo a la imagen (Google Drive, Imgur, etc.)</p>

            <div class="modal-actions">
                <button type="submit" class="btn-primary" id="btn-save">💾 Guardar</button>
                <button type="button" class="btn-ghost" id="btn-cancel">Cancelar</button>
            </div>
            <p id="modal-error" class="error-msg hidden"></p>
        </form>
    </div>
</div>

<script src="admin.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/admin/index.html
git commit -m "feat(admin): add HTML structure for setup/login/dashboard/modal"
```

---

## Task 6: Admin Panel CSS

**Files:**
- Create: `public/admin/admin.css`

- [ ] **Step 1: Create admin styles**

Create `public/admin/admin.css`:

```css
/* ── Variables (match site palette) ────────────────────────── */
:root {
    --bg:        #0a0a0a;
    --surface:   #151515;
    --surface-2: #1e1e1e;
    --border:    #2a2a2a;
    --text:      #e8e8e8;
    --muted:     #888;
    --green:     #516843;
    --green-hover: #5f7a4f;
    --gold:      #EAB026;
    --danger:    #c0392b;
    --danger-hover: #e74c3c;
    --radius:    8px;
    --font:      'Outfit', sans-serif;
}

/* ── Reset ──────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    font-size: 14px;
    min-height: 100vh;
}

/* ── Utilities ──────────────────────────────────────────────── */
.hidden { display: none !important; }

.error-msg {
    color: #e74c3c;
    font-size: 13px;
    margin-top: 8px;
    padding: 8px 12px;
    background: rgba(192,57,43,0.15);
    border-radius: 4px;
    border-left: 3px solid #e74c3c;
}

/* ── Views ──────────────────────────────────────────────────── */
.view { min-height: 100vh; }

/* ── Auth (setup + login) ───────────────────────────────────── */
#view-setup,
#view-login {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
}

.auth-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 40px 32px;
    width: 100%;
    max-width: 380px;
}

.auth-logo {
    text-align: center;
    margin-bottom: 24px;
}
.auth-logo img {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 2px solid var(--green);
    padding: 8px;
    background: var(--surface-2);
}

.auth-title {
    font-size: 22px;
    font-weight: 600;
    text-align: center;
    margin-bottom: 4px;
}

.auth-subtitle {
    color: var(--muted);
    text-align: center;
    margin-bottom: 24px;
    font-size: 13px;
}

/* ── Forms ──────────────────────────────────────────────────── */
label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--muted);
    text-transform: uppercase;
    margin-bottom: 6px;
    margin-top: 16px;
}

label:first-of-type { margin-top: 0; }

.hint {
    font-size: 10px;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
}

input, select, textarea {
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text);
    padding: 9px 12px;
    font-family: var(--font);
    font-size: 14px;
    transition: border-color 0.2s;
}

input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--green);
}

textarea { resize: vertical; }

select option { background: var(--surface-2); }

.field-hint {
    font-size: 11px;
    color: var(--muted);
    margin-top: 4px;
}

/* ── Buttons ────────────────────────────────────────────────── */
.btn-primary {
    background: var(--green);
    color: white;
    border: none;
    border-radius: 5px;
    padding: 10px 18px;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}
.btn-primary:hover { background: var(--green-hover); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-ghost {
    background: transparent;
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 10px 18px;
    font-family: var(--font);
    font-size: 14px;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
}
.btn-ghost:hover { color: var(--text); border-color: #444; }

.btn-danger {
    background: transparent;
    color: var(--danger);
    border: 1px solid rgba(192,57,43,0.4);
    border-radius: 4px;
    padding: 5px 10px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
}
.btn-danger:hover { background: rgba(192,57,43,0.15); }

.btn-edit {
    background: var(--green);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 5px 10px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
}
.btn-edit:hover { background: var(--green-hover); }

/* ── Auth form submit button ────────────────────────────────── */
#form-setup .btn-primary,
#form-login .btn-primary {
    width: 100%;
    margin-top: 20px;
    padding: 12px;
    font-size: 15px;
}

/* ── Dashboard header ───────────────────────────────────────── */
.admin-header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 10;
}

.admin-header-inner {
    max-width: 960px;
    margin: 0 auto;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.admin-logo {
    display: flex;
    align-items: center;
    gap: 10px;
}

.admin-logo img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1.5px solid var(--green);
    padding: 5px;
    background: var(--surface-2);
}

.admin-logo span {
    font-weight: 600;
    font-size: 15px;
    color: var(--text);
}

.admin-header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

/* ── Main content area ──────────────────────────────────────── */
.admin-main {
    max-width: 960px;
    margin: 0 auto;
    padding: 24px 20px;
}

/* ── Tabs ────────────────────────────────────────────────────── */
.tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0;
}

.tab {
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--muted);
    padding: 8px 16px;
    font-family: var(--font);
    font-size: 14px;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
    margin-bottom: -1px;
}

.tab:hover { color: var(--text); }

.tab.active {
    color: var(--gold);
    border-bottom-color: var(--gold);
}

/* ── Card grid ───────────────────────────────────────────────── */
.admin-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
}

.item-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    transition: border-color 0.2s;
}

.item-card:hover { border-color: #3a3a3a; }

.item-card-img {
    width: 100%;
    height: 140px;
    object-fit: cover;
    display: block;
    background: var(--surface-2);
}

.item-card-img-placeholder {
    width: 100%;
    height: 140px;
    background: var(--surface-2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    color: #333;
}

.item-card-body {
    padding: 12px;
}

.item-card-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.item-card-desc {
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 8px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.item-card-price {
    color: var(--gold);
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 10px;
}

.item-card-actions {
    display: flex;
    gap: 6px;
}

/* ── Empty state ─────────────────────────────────────────────── */
.empty-state {
    text-align: center;
    color: var(--muted);
    padding: 60px 20px;
    line-height: 1.8;
}

/* ── Modal ───────────────────────────────────────────────────── */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 100;
    backdrop-filter: blur(2px);
}

.modal-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    width: 100%;
    max-width: 440px;
    max-height: 90vh;
    overflow-y: auto;
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
}

.modal-header h2 {
    font-size: 16px;
    font-weight: 600;
}

.modal-close {
    background: transparent;
    border: none;
    color: var(--muted);
    font-size: 18px;
    cursor: pointer;
    line-height: 1;
    padding: 4px;
    transition: color 0.2s;
}
.modal-close:hover { color: var(--text); }

#form-item {
    padding: 20px;
}

.modal-actions {
    display: flex;
    gap: 8px;
    margin-top: 20px;
}

/* ── Responsive ─────────────────────────────────────────────── */
@media (max-width: 600px) {
    .admin-header-inner { flex-direction: column; align-items: flex-start; gap: 8px; }
    .admin-header-actions { width: 100%; justify-content: flex-end; }
    .admin-grid { grid-template-columns: 1fr 1fr; }
    .modal-card { max-height: 100vh; border-radius: 0; }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/admin/admin.css
git commit -m "feat(admin): add dark-theme admin panel styles"
```

---

## Task 7: Admin Panel JavaScript

**Files:**
- Create: `public/admin/admin.js`

- [ ] **Step 1: Create the complete admin.js**

Create `public/admin/admin.js`:

```javascript
/**
 * Kettu Café Admin Panel
 * Handles auth flow (setup/login), menu CRUD, and modal management.
 */

// ── State ─────────────────────────────────────────────────────────────────────

let token = localStorage.getItem('kettu_token');
let currentTab = 'cafe';
let allItems = [];

// ── DOM helpers ───────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
function show(id)  { $(id).classList.remove('hidden'); }
function hide(id)  { $(id).classList.add('hidden'); }
function showErr(id, msg) { const el = $(id); el.textContent = msg; el.classList.remove('hidden'); }
function hideErr(id)      { $(id).classList.add('hidden'); }

// ── API calls ─────────────────────────────────────────────────────────────────

async function api(method, path, body) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body)  opts.body = JSON.stringify(body);

    const res  = await fetch(path, opts);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

// ── Views ─────────────────────────────────────────────────────────────────────

function showView(name) {
    ['setup', 'login', 'dashboard'].forEach(v => hide(`view-${v}`));
    show(`view-${name}`);
}

// ── Setup flow ────────────────────────────────────────────────────────────────

function initSetupForm() {
    $('form-setup').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideErr('setup-error');
        const btn = $('btn-setup');
        btn.disabled = true;
        btn.textContent = 'Creando...';

        const username = $('setup-username').value.trim();
        const password = $('setup-password').value;

        const { ok, data } = await api('POST', '/api/admin/setup', { username, password });

        if (ok) {
            // Auto-login after setup
            await doLogin(username, password);
        } else {
            showErr('setup-error', data.error || 'Error al crear el usuario.');
            btn.disabled = false;
            btn.textContent = 'Crear cuenta';
        }
    });
}

// ── Login flow ────────────────────────────────────────────────────────────────

function initLoginForm() {
    $('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideErr('login-error');
        const btn = $('btn-login');
        btn.disabled = true;
        btn.textContent = 'Ingresando...';

        const username = $('login-username').value.trim();
        const password = $('login-password').value;

        const success = await doLogin(username, password);
        if (!success) {
            btn.disabled = false;
            btn.textContent = 'Entrar';
        }
    });
}

async function doLogin(username, password) {
    const { ok, data } = await api('POST', '/api/admin/login', { username, password });
    if (ok) {
        token = data.token;
        localStorage.setItem('kettu_token', token);
        await loadDashboard();
        return true;
    } else {
        showErr('login-error', 'Usuario o contraseña incorrectos.');
        return false;
    }
}

// ── Logout ────────────────────────────────────────────────────────────────────

function initLogout() {
    $('btn-logout').addEventListener('click', () => {
        token = null;
        localStorage.removeItem('kettu_token');
        showView('login');
    });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

async function loadDashboard() {
    const { ok, status, data } = await api('GET', '/api/admin/items');

    if (!ok) {
        if (status === 401) {
            token = null;
            localStorage.removeItem('kettu_token');
            showView('login');
        }
        return;
    }

    allItems = data.items;
    showView('dashboard');
    renderTab(currentTab);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function initTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            currentTab = btn.dataset.tab;
            renderTab(currentTab);
        });
    });
}

function renderTab(tab) {
    const items = allItems.filter(i => i.category === tab);
    const grid  = $('admin-grid');
    const empty = $('grid-empty');

    grid.innerHTML = '';

    if (items.length === 0) {
        show('grid-empty');
        return;
    }
    hide('grid-empty');

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.dataset.id = item.id;
        card.innerHTML = `
            ${item.image_url
                ? `<img class="item-card-img" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : ''}
            <div class="item-card-img-placeholder" style="${item.image_url ? 'display:none' : ''}">📷</div>
            <div class="item-card-body">
                <div class="item-card-title">${escapeHtml(item.title)}</div>
                ${item.description ? `<div class="item-card-desc">${escapeHtml(item.description)}</div>` : ''}
                <div class="item-card-price">${escapeHtml(item.price)}</div>
                <div class="item-card-actions">
                    <button class="btn-edit" data-action="edit" data-id="${item.id}">✏️ Editar</button>
                    <button class="btn-danger" data-action="delete" data-id="${item.id}">🗑 Borrar</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ── Card actions (edit / delete) ──────────────────────────────────────────────

function initCardActions() {
    $('admin-grid').addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const id     = parseInt(btn.dataset.id, 10);
        const action = btn.dataset.action;
        const item   = allItems.find(i => i.id === id);

        if (action === 'edit' && item) {
            openModal(item);
        }

        if (action === 'delete' && item) {
            const confirmed = confirm(`¿Borrar "${item.title}"? Esta acción no se puede deshacer.`);
            if (!confirmed) return;

            const { ok } = await api('DELETE', `/api/admin/items/${id}`);
            if (ok) {
                allItems = allItems.filter(i => i.id !== id);
                renderTab(currentTab);
            }
        }
    });
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(item = null) {
    hideErr('modal-error');

    if (item) {
        $('modal-title').textContent    = 'Editar item';
        $('item-id').value              = item.id;
        $('item-category').value        = item.category;
        $('item-title').value           = item.title;
        $('item-description').value     = item.description || '';
        $('item-price').value           = item.price;
        $('item-image').value           = item.image_url || '';
    } else {
        $('modal-title').textContent    = 'Nuevo item';
        $('item-id').value              = '';
        $('item-category').value        = currentTab;
        $('item-title').value           = '';
        $('item-description').value     = '';
        $('item-price').value           = '';
        $('item-image').value           = '';
    }

    show('modal-overlay');
    $('item-title').focus();
}

function closeModal() {
    hide('modal-overlay');
}

function initModal() {
    $('btn-new').addEventListener('click', () => openModal(null));
    $('btn-modal-close').addEventListener('click', closeModal);
    $('btn-cancel').addEventListener('click', closeModal);

    // Close on overlay click
    $('modal-overlay').addEventListener('click', (e) => {
        if (e.target === $('modal-overlay')) closeModal();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    $('form-item').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideErr('modal-error');

        const btn = $('btn-save');
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        const id = $('item-id').value;
        const body = {
            category:    $('item-category').value,
            title:       $('item-title').value.trim(),
            description: $('item-description').value.trim(),
            price:       $('item-price').value.trim(),
            image_url:   $('item-image').value.trim(),
            sort_order:  0,
        };

        let res;
        if (id) {
            res = await api('PUT',  `/api/admin/items/${id}`, body);
        } else {
            res = await api('POST', '/api/admin/items', body);
        }

        btn.disabled = false;
        btn.textContent = '💾 Guardar';

        if (res.ok) {
            closeModal();
            await loadDashboard(); // Reload all items
        } else {
            showErr('modal-error', res.data.error || 'Error al guardar el item.');
        }
    });
}

// ── XSS protection ────────────────────────────────────────────────────────────

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    initSetupForm();
    initLoginForm();
    initLogout();
    initTabs();
    initCardActions();
    initModal();

    // Determine which view to show
    const { data } = await api('GET', '/api/admin/check');

    if (!data.hasUsers) {
        showView('setup');
        return;
    }

    if (token) {
        await loadDashboard();
        // loadDashboard redirects to login if token is invalid
    } else {
        showView('login');
    }
}

init();
```

- [ ] **Step 2: Commit**

```bash
git add public/admin/admin.js
git commit -m "feat(admin): add complete admin panel JS (auth, CRUD, modal)"
```

---

## Task 8: End-to-End Test & Production Deploy

**Files:** No new files. Manual testing + deploy.

- [ ] **Step 1: Run full local test**

Start dev server:
```bash
npx wrangler pages dev public --local
```

1. Open `http://localhost:8788/admin` in browser
2. Verify setup screen appears (first run)
3. Create admin account: `admin` / `kettu2026`
4. Verify redirect to dashboard
5. Verify all 3 seeded items appear in correct tabs (Café → Flat White, etc.)
6. Click "Editar" on Flat White → verify modal opens pre-filled
7. Change price to `$3500` and save → verify card updates
8. Click "+ Agregar item" → create a new Cappuccino in Café tab → verify it appears
9. Delete the Cappuccino → verify it disappears
10. Click "Salir" → verify redirect to login
11. Log back in → verify dashboard loads

- [ ] **Step 2: Test landing page loads menu**

1. Open `http://localhost:8788` (not `/admin`)
2. Go to "Nuestra Propuesta" section
3. Verify all menu items load (including the updated Flat White price)
4. Switch between Café / Pastelería / Brunch tabs — items should appear

- [ ] **Step 3: Apply migration to remote D1**

```bash
npx wrangler d1 migrations apply kettu-cafe-db --remote
```

Expected: `✅ Applied 1 migration`

- [ ] **Step 4: Add SECRET_KEY to production Worker**

```bash
npx wrangler pages secret put SECRET_KEY
```
When prompted, paste a strong random key (min 32 chars). Example of generating one:
```bash
openssl rand -base64 32
```

- [ ] **Step 5: Deploy to Cloudflare Pages**

```bash
npx wrangler pages deploy public
```

- [ ] **Step 6: Smoke test production**

1. Open `https://kettu-cafe.pages.dev` — menu should load from D1
2. Open `https://kettu-cafe.pages.dev/admin` — should show setup OR login

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: admin panel MVP — JWT auth, menu CRUD, dynamic landing"
```

---

## Self-Review Checklist

| Spec Requirement | Covered by |
|-----------------|------------|
| Admin at `/admin` | Task 5 — `public/admin/index.html` |
| Edit title, description, photo, price | Task 7 — modal form fields |
| JWT auth + users in D1 | Task 2 — Pages Function + Task 1 — migration |
| First-run setup (no hardcoded password) | Task 2 — `/api/admin/setup` + `/api/admin/check` |
| Password hashed with SHA-256 + salt | Task 2 — `hashPassword()` + `generateSalt()` |
| Grid of cards (same aesthetic) | Task 6 — admin.css cards |
| Modal popup for editing | Task 7 — `openModal()` / `closeModal()` |
| Public menu via `/api/menu` | Task 2 — `handleGetMenu()` |
| Landing menu dynamic | Task 4 — `loadMenu()` in main.js |
| Images via URL | Task 5 — `item-image` input field |
| Seed data (3 existing items) | Task 1 — migration INSERT |
| Reusable template (CSS vars) | Task 6 — `:root` variables |
| NOT in scope: R2 upload | — |
| NOT in scope: multi-user roles | — |

---

## NOT in Scope

- Image upload (Cloudflare R2) — URL pasting is the UX
- Multi-user with roles — one admin per deployment
- Audit log / change history
- Drag-and-drop reordering (sort_order is editable in modal)
- Cloudflare Access / OAuth
- Password change UI (for now, done via a new setup after DB wipe — document in deploy guide)
