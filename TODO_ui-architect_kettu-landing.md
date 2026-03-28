### Context
- **Feature Name:** Kettu Café Landing Page
- **Architecture Strategy:** Modern, responsive, and performance-optimized. We will use a component-based approach even in Vanilla JS/HTML to ensure maintainability and a "premium" feel (no generic templates).

### 1. New Components to Build / Extend

- [x] **UI-PLAN-1.1 [HeroSection]**:
  - **Atomic Level**: Organism
  - **Variants**: Full-screen green background with texture overlay.
  - **Props**: Title (Logo), CTA Label, Background Texture URL.
  - **Done**: CSS grain/SVG noise overlay on body (no external CDN). Hero section uses `exterior.jpg` as full-screen background with gradient overlay.

- [x] **UI-PLAN-1.2 [MenuCategory]**:
  - **Atomic Level**: Molecule
  - **Variants**: Tabbed on desktop, same tabs on mobile (full-screen nav).
  - **Props**: Category Name, Icon ID, Items List.
  - **Done**: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` + `role="tabpanel"` + `aria-labelledby` on all grids. JS updates `aria-selected` on click.

- [x] **UI-PLAN-1.3 [ProductCard]**:
  - **Atomic Level**: Atom
  - **Variants**: Standard (16/10 aspect-ratio), Featured (16/9 + green left-border accent).
  - **Props**: Name, Description, Price, Image URL.
  - **Done**: `.product-card.featured` variant added to CSS with `border-left: 3px solid var(--primary)` and wider image.

### 2. Component Implementation Details

- [x] **UI-ITEM-1.1 [Navigation] Implementation**:
  - **API**: Sticky header that transforms on scroll.
  - **Accessibility**: ARIA labels for "Open Menu", keyboard navigation for anchors.
  - **Done**: `aria-expanded` toggled programmatically in JS on `.menu-toggle`. Updated nav CTA to "Visitarnos" with `.nav-cta` class.

- [x] **UI-ITEM-1.2 [Image Gallery] Implementation**:
  - **API**: Modern CSS columns grid with aspect-ratio management.
  - **Accessibility**: Descriptive alt tags, `loading="lazy"` on all images, `role="list/listitem"`.
  - **Done**: IntersectionObserver scroll-reveal for all `.gallery-item` and `.product-card`. Fade-in + translateY animation on enter.

### 3. Proposed Strategy
- [x] Use CSS Variables for the identified palette (`#516843`, `#EAB026`, etc.).
- [x] Implement a "Paper Texture" overlay using an inline SVG `feTurbulence` filter (no external dependency).
- [x] Focus strictly on typography: Playfair Display (serif headers) + Outfit (sans body).

### 4. Quality Assurance Checklist
- [x] Components are mobile-first and responsive.
- [x] Performance: `loading="lazy"` on all non-critical images. CSS grain texture is inline (no network request).
- [x] Accessibility: WCAG 2.1 AA — `role="tab"` pattern, `aria-expanded`, descriptive alts, keyboard nav.
