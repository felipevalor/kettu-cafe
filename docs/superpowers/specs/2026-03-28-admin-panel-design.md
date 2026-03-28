# Admin Panel — Kettu Café (Plantilla Reutilizable)

**Fecha:** 2026-03-28
**Estado:** Aprobado
**Proyecto:** Kettu Café — Panel de Administración de Menú

---

## 1. Objetivo

Crear un panel de administrador accesible desde `/admin` que permita al dueño de la cafetería gestionar los items de la sección "Nuestra Propuesta" (títulos, descripciones, fotos y precios) sin tocar código. El diseño es una plantilla reutilizable para otros clientes de Valor Solutions.

---

## 2. Decisiones de Diseño

| Decisión | Elección | Razón |
|----------|----------|-------|
| Alcance | Plantilla reutilizable | Reutilizar para futuros clientes |
| Auth | Usuario + contraseña en D1 + JWT | Flexible para múltiples admins por cliente |
| Imágenes | URL externa (link libre) | Cero infraestructura extra; el dueño puede usar Drive, Imgur, etc. |
| Layout admin | Grid de cards (espejo del sitio) | Más familiar para dueños no técnicos |
| Edición | Modal popup | Editar sin perder contexto |
| Criptografía | Web Crypto API nativa | Sin dependencias externas; compatible con CF Workers |

---

## 3. Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE PAGES                            │
│  public/                                                        │
│  ├── index.html          ← landing (fetch dinámico del menú)    │
│  └── admin/                                                     │
│      ├── index.html      ← SPA del panel de admin              │
│      ├── admin.css       ← estilos del panel                    │
│      └── admin.js        ← lógica CRUD + auth JWT              │
└──────────────────────────────┬──────────────────────────────────┘
                               │ fetch /api/*
┌──────────────────────────────▼──────────────────────────────────┐
│                    CLOUDFLARE WORKER                            │
│  POST /api/admin/setup        ← solo si users está vacío (first-run) │
│  POST /api/admin/login       ← valida user+pass, devuelve JWT        │
│  GET  /api/menu              ← público, lee menu_items               │
│  GET  /api/admin/items       ← protegido (JWT), lista items          │
│  POST /api/admin/items       ← protegido, crea item                  │
│  PUT  /api/admin/items/:id   ← protegido, edita item                 │
│  DELETE /api/admin/items/:id ← protegido, elimina item               │
└──────────────────────────────┬──────────────────────────────────┘
                               │ SQL
┌──────────────────────────────▼──────────────────────────────────┐
│                       CLOUDFLARE D1                             │
│  TABLE users          TABLE menu_items                          │
│  ─────────────────    ──────────────────────────────────────    │
│  id INTEGER PK        id INTEGER PK                             │
│  username TEXT        category TEXT  (cafe/pastry/brunch)       │
│  password_hash TEXT   title TEXT NOT NULL                       │
│  password_salt TEXT   description TEXT                          │
│  created_at DATETIME  price TEXT NOT NULL                       │
│                       image_url TEXT                            │
│                       sort_order INTEGER DEFAULT 0              │
│                       created_at DATETIME DEFAULT CURRENT_TS    │
│                       updated_at DATETIME DEFAULT CURRENT_TS    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Flujo del Usuario (Dueño del Café)

```
Abre /admin
     │
     ▼
┌─────────────┐    credenciales    ┌──────────────────┐
│  Login form │ ─────────────────► │ POST /api/admin/ │
│  user + pass│                    │ login            │
└─────────────┘                    └────────┬─────────┘
                                            │ JWT (7 días)
                                            ▼
                                   localStorage: 'kettu_token'
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────┐
│  Panel principal — Grid de cards                              │
│  Tabs: [Café] [Pastelería] [Brunch]                [+ Nuevo] │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │  Foto    │  │  Foto    │  │  Foto    │                   │
│  │──────────│  │──────────│  │──────────│                   │
│  │ Título   │  │ Título   │  │ Título   │                   │
│  │ Precio   │  │ Precio   │  │ Precio   │                   │
│  │[Edit][X] │  │[Edit][X] │  │[Edit][X] │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└───────────────────────────────────────────────────────────────┘
         │ click Editar / Nuevo
         ▼
┌─────────────────────────────────┐
│  Modal de edición               │
│  ─────────────────────────────  │
│  Categoría: [dropdown]          │
│  Nombre:    [input]             │
│  Descripción: [textarea]        │
│  Precio:    [input]  ($3200)    │
│  URL foto:  [input]  (link)     │
│                                 │
│  [💾 Guardar]  [Cancelar]       │
└─────────────────────────────────┘
```

---

## 5. Auth Flow

1. `POST /api/admin/login` recibe `{ username, password }`
2. Worker busca el usuario en D1
3. Hashea `password + salt` con SHA-256 (Web Crypto API)
4. Compara con `password_hash` almacenado
5. Si válido: genera JWT (`HMAC-SHA256`, payload: `{ sub: userId, exp: now+7days }`, firmado con `SECRET_KEY` env var)
6. Cliente guarda el JWT en `localStorage` como `kettu_token`
7. Todos los requests a `/api/admin/*` incluyen `Authorization: Bearer <token>`
8. Worker valida firma y expiración del JWT en cada request

**Variable de entorno requerida:** `SECRET_KEY` (mínimo 32 chars aleatorios)

---

## 6. Cambios al Landing Público

El archivo `public/index.html` actualmente tiene los items del menú hardcodeados en HTML. Se debe:

1. **Eliminar** los `<div class="product-card">` hardcodeados de las 3 categorías
2. Dejar los contenedores `<div class="menu-grid" id="coffee">` vacíos (solo el wrapper)
3. En `public/js/main.js`, agregar lógica para hacer `fetch('/api/menu')` al cargar la página y renderizar dinámicamente los cards

Esto desacopla el contenido del código y permite que el admin panel sea la única fuente de verdad.

---

## 7. Archivos a Crear / Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `public/admin/index.html` | CREAR | SPA del panel de admin |
| `public/admin/admin.css` | CREAR | Estilos del panel (dark theme, espejo del sitio) |
| `public/admin/admin.js` | CREAR | Lógica: auth JWT, CRUD, modal, tabs |
| `migrations/002_menu_and_users.sql` | CREAR | Tablas `menu_items` y `users` + datos iniciales |
| `worker/index.js` | MODIFICAR | Agregar 6 endpoints nuevos |
| `public/js/main.js` | MODIFICAR | Fetch dinámico del menú |
| `public/index.html` | MODIFICAR | Remover items hardcodeados |

**Total:** 7 archivos (3 nuevos, 4 modificados)

---

## 8. Migración de Datos

La migración `002_menu_and_users.sql` incluye:
- Creación de tablas `users` y `menu_items`
- **Seed data:** los 3 items actuales del HTML migrados a D1 (Flat White, Croissant Clásico, Avocado Toast)
- **Sin usuario hardcodeado.** El primer acceso a `/admin` detecta que no hay usuarios en D1 y muestra un formulario de "Configuración inicial" para crear el primer admin (username + password). El endpoint `POST /api/admin/setup` solo funciona cuando la tabla `users` está vacía (un solo uso, luego se bloquea automáticamente).

---

## 9. Seguridad

- Contraseñas hasheadas con `SHA-256 + salt` aleatorio por usuario (Web Crypto API)
- JWT firmado con `HMAC-SHA256`, no base64 simple
- `SECRET_KEY` como variable de entorno del Worker (no en código)
- `/api/menu` es público y de solo lectura
- Todos los endpoints `/api/admin/*` requieren JWT válido
- CORS configurado para origen del dominio del cliente

---

## 10. Template para Nuevos Clientes

Para reutilizar esta plantilla en un nuevo cliente:
1. Copiar la estructura de archivos
2. Cambiar `database_id` en `wrangler.toml`
3. Cambiar `SECRET_KEY` en las variables de entorno del Worker
4. Correr la migración con los items del nuevo menú
5. Ajustar colores/logo en `admin.css` (variables CSS)

---

## 11. NOT en Scope

- Upload de imágenes (Cloudflare R2) — se usa URL externa
- Multi-usuario con roles — un admin por sitio
- Historial de cambios / audit log
- Preview del landing desde el admin
- Ordenar items con drag & drop (usar `sort_order` para ordenar, editable por número)
- Autenticación con OAuth / magic link
