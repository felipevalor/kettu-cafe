# Project: Kettu Café - Landing Page & Infrastructure

This document provides a comprehensive overview of the Kettu Café project, including its architecture, design philosophy, tech stack, and development workflows.

---

## ☕ Project Overview
**Kettu Café** is a specialty coffee shop located in **Barrio Martin** (9 de Julio 504, Rosario). The goal of this project is to establish a premium digital presence that balances high-end artisan branding with the accessibility of a neighborhood specialty spot.

- **Developer**: Valor Solutions (Freelance Argentina)
- **Primary Objective**: Establish brand presence, facilitate menu discovery, and capture leads/contact requests.
- **Key Location**: Barrio Martin, 9 de Julio 504.

---

## 🛠 Tech Stack
The project is built entirely on the **Cloudflare Ecosystem** for maximum performance, global delivery, and low cost.

| Layer | Technology | Description |
|-------|------------|-------------|
| **Frontend** | Vanilla HTML/CSS/JS | No frameworks (React/Vue/etc.) to maintain 100/100 Lighthouse performance. |
| **Hosting** | Cloudflare Pages | Global CDN for lightning-fast asset delivery. |
| **Backend** | Cloudflare Workers | Serverless API for handling forms and database interactions. |
| **Database** | Cloudflare D1 (SQLite) | Edge database for storing customer leads. |
| **Deployment** | Wrangler CLI v4+ | Infrastructure as code via `wrangler.toml`. |

---

## 📂 Directory Structure

```text
kettu-cafe/
├── public/                  # All frontend assets (Static Site)
│   ├── css/                 # Modern, premium CSS (Variables, Animations)
│   ├── js/                  # Component logic (Tabs, IntersectionObserver)
│   ├── img/                 # High-quality photography & logos
│   └── index.html           # Main entry point (Semantic HTML5)
├── worker/                  # Cloudflare Worker for API endpoints
│   └── index.js             # Handler for /api/contact -> SQL D1
├── functions/               # Cloudflare Pages Functions (Alternative API routing)
├── migrations/              # D1 Database schema migrations
│   └── 001_initial_schema.sql
├── wrangler.toml            # Central Cloudflare configuration (Bindings, Env)
├── package.json             # Dev dependencies (Wrangler)
└── README.md                # General developer instructions
```

---

## 🎨 Design Philosophy
The aesthetic is defined as **"Artesanal / Tech / Texturizado"**.

### Design Tokens
- **Background**: `#0a0a0a` (Pure dark)
- **Primary (Green)**: `#516843` (Earthy specialty coffee vibe)
- **Accent (Gold)**: `#EAB026`
- **Typography**: 
  - *Headers*: Playfair Display (Serif, Premium)
  - *Body*: Outfit (Sans-serif, Modern)
- **Textures**: Inline SVG `feTurbulence` for a "paper/grain" noise overlay on the entire site.

### Key UX Mechanics
- **Progressive Disclosure**: Menu categories (Cafetería, Pastelería, etc.) are separated by tabs to avoid scroll fatigue.
- **Conversion Drivers**: Sticky "Ver la Carta" button on mobile, clear "Barrio Martin" local anchoring.
- **Subtle Polish**: Custom cursor, IntersectionObserver for "reveal-on-scroll" animations.

---

## 📡 API & Backend
The API resides in the `worker/` directory (and/or `functions/`).

- **Base URL**: `*.pages.dev` or custom domain.
- **Endpoints**:
  - `POST /api/contact`: Accepts `name`, `email`, and `message`. Validates and inserts into the `leads` table in D1.
- **Database Schema (`leads`)**:
  - `id` (INTEGER, Primary Key)
  - `name` (TEXT)
  - `email` (TEXT)
  - `message` (TEXT)
  - `created_at` (TIMESTAMP)

---

## 🚀 Development & Deployment

### Local Development
1. Install dependencies: `npm install`
2. Run local dev server: `npx wrangler pages dev public`
3. Test Workers locally: `npx wrangler dev worker/index.js --remote`

### Deployment
Deployment is manual or via CI/CD using Wrangler:
```bash
# Deploy Frontend
npx wrangler pages deploy public

# Deploy Backend (Worker)
npx wrangler deploy worker/index.js

# Database Migrations
npx wrangler d1 migrations apply kettu-cafe-db --remote
```

---

## 🗺 Roadmap & Status
Current progress is tracked in `TODO_ui-architect_kettu-landing.md` and `TODO_ux-strategy_kettu-landing.md`.

- [x] **Phase 1**: Initial landing structure & visual identity.
- [x] **Phase 2**: Menu implementation with tabbed navigation.
- [x] **Phase 3**: Contact form integration with D1.
- [ ] **Phase 4**: Logo scaling & final SEO polish (ongoing).
- [ ] **Future**: Integration with online ordering/payment systems.

---

> **Note for AI Agents**: Always adhere to the `user_global` rules for Valor Solutions. Maintain 100 on Lighthouse and use only Vanilla tech unless explicitly requested otherwise.
