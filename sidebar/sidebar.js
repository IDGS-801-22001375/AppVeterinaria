(() => {
    const links = document.querySelectorAll('.sidebar .menu-item[href]');
    for (const link of links) {
        link.addEventListener('click', event => {
            const url = new URL(link.href, location.href);
            if (!url.hash || url.pathname !== location.pathname) return;
            const target = document.getElementById(url.hash.slice(1));
            if (!target) return;
            event.preventDefault();
            history.replaceState(null, '', url.hash);
            target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
            target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
            for (const item of links) { item.classList.remove('active'); item.removeAttribute('aria-current'); }
            link.classList.add('active');
            link.setAttribute('aria-current', 'location');
        });
    }
})();
