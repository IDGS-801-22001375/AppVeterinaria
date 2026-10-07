const CACHE = 'huellitas-shell-v4';
const ASSETS = ['/', '/PaginaPrincipal.html', '/styles.css', '/img/huella.png', '/img/hero.jpg', '/dashboard/dashboard.html', '/dashboard/styleDash.css', '/dashboard/dashboard.js', '/sidebar/styleBar.css', '/sidebar/sidebar.js', '/mascotas/mascotas.js', '/usuarios/usuarios.js', '/auth/login.html', '/auth/register.html', '/auth/prueba.html', '/auth/styles/login.css', '/auth/styles/register.css', '/auth/js/auth.js', '/auth/js/validation.js', '/pwa/offline.js', '/pwa/local-auth.js', '/pwa/register.js', '/pwa/pwa.css', '/manifest.webmanifest', '/pwa/icon-192.png', '/pwa/icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('huellitas-shell-') && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])));
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || !ASSETS.includes(url.pathname)) return;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        try {
            const response = await fetch(event.request);
            if (response.ok) await cache.put(url.pathname, response.clone());
            return response;
        } catch {
            return await cache.match(url.pathname) || new Response('Abre esta página con conexión una vez.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }
    })());
});
