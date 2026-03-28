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

    const res = await fetch(path, opts);
    let data;
    try {
        data = await res.json();
    } catch {
        data = { error: `Error del servidor (${res.status})` };
    }
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
            const loginOk = await doLogin(username, password);
            if (!loginOk) {
                // Setup succeeded but auto-login failed — redirect to login view
                showView('login');
                showErr('login-error', 'Cuenta creada. Ingresá con tu usuario y contraseña.');
            }
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

async function doLogin(username, password, showLoginErr = true) {
    const { ok, data } = await api('POST', '/api/admin/login', { username, password });
    if (ok) {
        token = data.token;
        localStorage.setItem('kettu_token', token);
        await loadDashboard();
        return true;
    } else {
        if (showLoginErr) showErr('login-error', 'Usuario o contraseña incorrectos.');
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

    $('modal-overlay').addEventListener('click', (e) => {
        if (e.target === $('modal-overlay')) closeModal();
    });

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
            await loadDashboard();
        } else {
            showErr('modal-error', res.data.error || 'Error al guardar el item.');
        }
    });
}

// ── Google Drive URL converter ────────────────────────────────────────────────

function initDriveConverter() {
    const input = $('item-image');
    const hint  = $('img-drive-hint');

    input.addEventListener('input', () => {
        const match = input.value.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match) {
            input.value = `https://lh3.googleusercontent.com/d/${match[1]}`;
            hint.classList.remove('hidden');
        } else {
            hint.classList.add('hidden');
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
    initDriveConverter();

    const { data } = await api('GET', '/api/admin/check');

    if (!data.hasUsers) {
        showView('setup');
        return;
    }

    if (token) {
        await loadDashboard();
    } else {
        showView('login');
    }
}

init();
