(() => {
    'use strict';

    const TOKEN_KEY = 'veterinaria.token';
    // Live Server sirve el HTML; Express procesa la API en el puerto 3000.
    const isLiveServer = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
        && location.port === '5500';
    const apiOrigin = isLiveServer ? `${location.protocol}//${location.hostname}:3000` : '';
    const message = document.getElementById('auth-message');
    const form = document.querySelector('form[data-auth]');
    const sessionPage = document.querySelector('[data-session-page]');

    function showMessage(text) {
        message.textContent = text;
        message.hidden = !text;
    }

    async function request(url, options = {}) {
        if (apiOrigin) {
            const endpoint = new URL(url, location.origin);
            url = apiOrigin + endpoint.pathname + endpoint.search;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const error = new Error(data.mensaje || 'No se pudo completar la solicitud. Inténtalo de nuevo.');
                error.status = response.status;
                throw error;
            }
            return data;
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('El servidor tardó demasiado. Inténtalo de nuevo.');
            if (error instanceof TypeError) throw new Error('No se pudo conectar con el backend. Ejecuta npm.cmd start y verifica que el servidor esté disponible.');
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    if (form) {
        const endpoint = form.dataset.auth === 'login' ? '/api/auth/login' : '/api/auth/registro';
        showMessage('');
        if (form.dataset.auth === 'login' && new URLSearchParams(location.search).has('registrado')) {
            showMessage('Cuenta creada correctamente. Ya puedes iniciar sesión.');
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const button = form.querySelector('button[type="submit"]');
            if (button.disabled || !form.reportValidity()) return;
            const values = Object.fromEntries(new FormData(form));
            for (const key of Object.keys(values)) {
                if (key !== 'password') values[key] = values[key].trim();
            }
            if (Object.values(values).some((value) => !value)) {
                showMessage('Completa todos los campos obligatorios.');
                return;
            }

            const originalText = button.textContent;
            button.disabled = true;
            button.textContent = 'Enviando…';
            form.setAttribute('aria-busy', 'true');
            showMessage('');
            try {
                const data = await request(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(values)
                });
                if (form.dataset.auth === 'login') {
                    if (typeof data.token !== 'string' || !data.token) {
                        throw new Error('El servidor no devolvió una sesión válida.');
                    }
                    try {
                        sessionStorage.setItem(TOKEN_KEY, data.token);
                    } catch {
                        throw new Error('Permite el almacenamiento de sesión del navegador para iniciar sesión.');
                    }
                    location.replace('/auth/prueba.html');
                } else {
                    location.replace('/auth/login.html?registrado=1');
                }
            } catch (error) {
                showMessage(error.message);
            } finally {
                button.disabled = false;
                button.textContent = originalText;
                form.removeAttribute('aria-busy');
            }
        });
        // Habilitar solo después de instalar el manejador que evita el POST nativo.
        form.querySelector('button[type="submit"]').disabled = false;
    }

    if (sessionPage) {
        const details = document.getElementById('session-title');
        const retry = document.getElementById('retry-session');
        const logout = document.getElementById('logout');

        logout.addEventListener('click', () => {
            sessionStorage.removeItem(TOKEN_KEY);
            location.replace('/auth/login.html');
        });

        async function verifySession() {
            details.hidden = true;
            retry.hidden = true;
            showMessage('Verificando tu sesión…');
            try {
                const token = sessionStorage.getItem(TOKEN_KEY);
                if (!token) {
                    location.replace('/auth/login.html');
                    return;
                }
                const data = await request('/api/auth/sesion', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!data.usuario) throw new Error('El servidor no devolvió los datos de la sesión.');
                details.hidden = false;
                logout.hidden = false;
                showMessage('');
            } catch (error) {
                if (error.status === 401 || error.status === 403) {
                    sessionStorage.removeItem(TOKEN_KEY);
                    location.replace('/auth/login.html');
                } else {
                    showMessage(error.message);
                    retry.hidden = false;
                }
            }
        }

        retry.addEventListener('click', verifySession);
        window.addEventListener('pageshow', verifySession);
    }
})();
