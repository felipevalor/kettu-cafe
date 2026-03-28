/**
 * Kettu Cafe - Main Interactions
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Header Scroll Effect
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // 1.2 Sticky Mobile CTA — UX-FIX-1.2
    const stickyCta = document.getElementById('sticky-cta');
    const heroSection = document.getElementById('home');
    const contactSection = document.getElementById('contact');

    if (stickyCta && heroSection) {
        const updateStickyCta = () => {
            const heroBottom = heroSection.getBoundingClientRect().bottom;
            const contactTop = contactSection ? contactSection.getBoundingClientRect().top : Infinity;
            const windowHeight = window.innerHeight;

            // Show after scrolling past hero, hide when contact section is in view
            const shouldShow = heroBottom < 0 && contactTop > windowHeight * 0.5;
            stickyCta.classList.toggle('visible', shouldShow);
            stickyCta.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
        };

        window.addEventListener('scroll', updateStickyCta, { passive: true });
        updateStickyCta(); // run on load
    }

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
            if (targetId === '#') return;
            
            const targetElem = document.querySelector(targetId);
            if (targetElem) {
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
