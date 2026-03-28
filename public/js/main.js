/**
 * Kettu Cafe - Main Interactions
 */

document.addEventListener('DOMContentLoaded', () => {
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

    // 1. Header Scroll Effect
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });



    // 1.1 Mobile Menu Toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinksContainer = document.querySelector('.nav-links');
    const navLinksList = document.querySelectorAll('.nav-links a');

    if (menuToggle && navLinksContainer) {
        menuToggle.addEventListener('click', () => {
            const isOpen = menuToggle.classList.toggle('active');
            navLinksContainer.classList.toggle('active');
            document.body.classList.toggle('no-scroll');
            menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        navLinksList.forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                navLinksContainer.classList.remove('active');
                document.body.classList.remove('no-scroll');
            });
        });
    }

    // 2. Menu Tabs Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const menuGrids = document.querySelectorAll('.menu-grid');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            // Toggle active button + aria-selected (UI-PLAN-1.2 WCAG)
            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');

            // Toggle active grid
            menuGrids.forEach(grid => {
                if (grid.id === targetTab) {
                    grid.classList.add('active');
                } else {
                    grid.classList.remove('active');
                }
            });
        });
    });

    // 3. Scroll-reveal for gallery items, product cards, and contact section (UI-ITEM-1.2)
    const revealEls = document.querySelectorAll('.gallery-item, .product-card, .contact-info, .contact-photo');
    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        revealEls.forEach(el => revealObserver.observe(el));
    } else {
        revealEls.forEach(el => el.classList.add('revealed'));
    }

    // 4. Smooth Scroll for all anchors
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            
            if (targetId === '#') {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
                return;
            }
            
            const targetElem = document.querySelector(targetId);
            if (targetElem) {
                // If it's the home section, scroll to absolute top
                if (targetId === '#home') {
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                    return;
                }

                const headerOffset = 90;
                const elementPosition = targetElem.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
});
