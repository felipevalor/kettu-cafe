### Context
- **Feature Name:** Kettu Café Landing Page
- **Architecture Strategy:** Modern, responsive, and performance-optimized. We will use a component-based approach even in Vanilla JS/HTML to ensure maintainability and a "premium" feel (no generic templates).

### 1. New Components to Build / Extend

- [ ] **UI-PLAN-1.1 [HeroSection]**:
  - **Atomic Level**: Organism
  - **Variants**: Full-screen green background with texture overlay.
  - **Props**: Title (Logo), CTA Label, Background Texture URL.
  
- [ ] **UI-PLAN-1.2 [MenuCategory]**:
  - **Atomic Level**: Molecule
  - **Variants**: Tabbed or accordion-like for desktop/mobile.
  - **Props**: Category Name, Icon ID, Items List.

- [ ] **UI-PLAN-1.3 [ProductCard]**:
  - **Atomic Level**: Atom
  - **Variants**: Standard description view, Featured view (with large image).
  - **Props**: Name, Description, Price, Image URL.

### 2. Component Implementation Details

- [ ] **UI-ITEM-1.1 [Navigation] Implementation**:
  - **API**: Sticky header that transforms on scroll.
  - **Accessibility**: ARIA labels for "Open Menu", keyboard navigation for anchors.
  
- [ ] **UI-ITEM-1.2 [Image Gallery] Implementation**:
  - **API**: Modern grid with aspect-ratio management.
  - **Accessibility**: Descriptive alt tags, lazy loading for performance.

### 3. Proposed Strategy
- Use CSS Variables for the identified palette (`#516843`, `#EAB026`, etc.).
- Implement a "Paper Texture" overlay using an SVG filter or a repeating PNG to achieve the "Artesanal" look requested.
- Focus strictly on typography: Choosing a high-end Serif for headers (e.g., *Sora* or *Outfit* as a body font, and a characterful Serif like *Fraunces* or *Playfair*).

### 4. Quality Assurance Checklist
- [ ] Components are mobile-first and responsive.
- [ ] Performance: Images optimized (WebP) and critical CSS prioritized.
- [ ] Accessibility: WCAG 2.1 AA compliant.
