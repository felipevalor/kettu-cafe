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
