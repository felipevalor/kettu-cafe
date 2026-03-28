# Kettu Café Landing Page Design Document

**Date:** 2026-03-27
**Status:** Draft (Approved for Spec Review)
**Project:** Kettu Café - Landing Page (Artesanal/Texturizado)

## 1. Project Overview
Kettu Café is a specialty neighborhood coffee shop in Barrio Martin, Rosario. This landing page aims to showcase its artisan character, provide quick access to the menu, and drive local engagement.

## 2. Goals & Success Criteria
- **Menu Discovery:** Customers should find the full menu in under 5 seconds.
- **Brand Story:** Communicate the "Neighborhood Cafe" soul with premium visuals.
- **Conversion:** Drive traffic to physical visits or WhatsApp delivery.

## 3. Architecture & Functional Specs
- **Tech Stack:** Vanilla HTML5, CSS3 (Modern features), Vanilla JS.
- **Structure:**
    - **Hero:** Moss Green background, logo centric, quick-action link.
    - **Menu Section:** Integrated cards with categories (Cofee, Pastries, Drinks).
    - **Location/Hours:** Map link and dynamic opening hours display.
    - **IG Integration:** Visual gallery (placeholder initially).
- **SEO & Performance:** 100 on Lighthouse, mobile-first, semantic HTML.

## 4. Visual Design System
- **Palette (Exact Hex):**
    - Moss Green: `#516843`
    - Mustard Yellow: `#EAB026`
    - Cream/Paper: `#F2D06B`
    - Steel Blue: `#93B2BD`
    - Charcoal Text: `#2D2A26`
- **Typography:**
    - Headers: *Fraunces* (Characterful Serif) or *Playfair Display*.
    - Body: *Outfit* (Modern Sans-Serif).
- **Aesthetic Direction:** "Premium Analog" — High contrast between green and cream, paper textures, grain overlays, and staggered reveals.

## 5. UI Elements & UX Highlights
- **Sticky Navigation:** Minimalist bar with logo and "Pedir" button.
- **Mobile Navigation:** Bottom-fixed navigation or simplified hamburger for one-handed usability.
- **Interactive Menu:** Tabbed categories to reduce scroll fatigue. Data source: `menu.json` via Cloudflare Worker/Fetch for easy updates.
- **Dynamic Hours:** Real-time "Abierto/Cerrado" status.
- **Social & SEO:** 
    - Open Graph (OG) tags for WhatsApp/Instagram sharing.
    - Footer Signature: "Built by Valor Solutions".

## 6. Testing & Quality Assurance
- **Performance:** 100/100 Lighthouse target. Use WebP formats, explicit dimensions, and `loading="lazy"`.
- **Accessibility:** WCAG 2.1 AA compliant (ARIA roles, semantic HTML).
- **Cross-browser:** Safari, Chrome, and Firefox mobile compatibility.

## 7. Next Steps
1. User Final Approval.
2. Implementation Plan.
3. Frontend Coding + Worker Setup.
