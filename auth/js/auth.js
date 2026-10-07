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

    function showMessage(text, type = 'error') {
        message.textContent = text;
        message.hidden = !text;
        message.dataset.type = type;
        message.setAttribute('role', type === 'error' ? 'alert' : 'status');
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
            if (error.name === 'AbortError') throw Object.assign(new Error('El servidor tardó demasiado. Inténtalo de nuevo.'), { network: true });
            if (error instanceof TypeError) throw Object.assign(new Error('No se pudo conectar con el servidor.'), { network: true });
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    if (form) {
        const endpoint = form.dataset.auth === 'login' ? '/api/auth/login' : '/api/auth/registro';
        showMessage('');
        if (form.dataset.auth === 'login' && new URLSearchParams(location.search).has('registrado')) {
            showMessage(new URLSearchParams(location.search).get('registrado') === 'local' ? 'Cuenta creada en este dispositivo. Ya puedes iniciar sesión sin conexión.' : 'Cuenta creada correctamente. Ya puedes iniciar sesión.', 'success');
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const button = form.querySelector('button[type="submit"]');
            if (button.disabled) return;
            const values = Object.fromEntries(new FormData(form));
            const { errors } = authValidation.validate(values, form.dataset.auth);
            for (const field of form.querySelectorAll('input')) {
                if (errors[field.name]) field.setAttribute('aria-invalid', 'true');
                else field.removeAttribute('aria-invalid');
            }
            if (Object.keys(errors).length) {
                showMessage(Object.values(errors).join('\n'));
                form.querySelector('[aria-invalid="true"]')?.focus();
                return;
            }
            for (const key of Object.keys(values)) {
                if (key !== 'password') values[key] = values[key].trim();
            }

            const originalText = button.textContent;
            button.disabled = true;
            button.textContent = 'Enviando…';
            form.setAttribute('aria-busy', 'true');
            showMessage('');
            try {
                if (form.dataset.auth === 'login') {
                    const data = typeof localAuth !== 'undefined'
                        ? await localAuth.login(values)
                        : await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
                    if (typeof data.token !== 'string' || !data.token) throw new Error('El servidor no devolvió una sesión válida.');
                    try { sessionStorage.setItem(TOKEN_KEY, data.token); }
                    catch { throw new Error('Permite el almacenamiento del navegador para iniciar sesión.'); }
                    location.replace('/dashboard/dashboard.html');
                } else {
                    if (typeof localAuth !== 'undefined' && !navigator.onLine) {
                        await localAuth.register(values);
                        location.replace('/auth/login.html?registrado=local');
                    } else {
                        try {
                            await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
                            location.replace('/auth/login.html?registrado=1');
                        } catch (error) {
                            if (!error.network || typeof localAuth === 'undefined') throw error;
                            await localAuth.register(values);
                            location.replace('/auth/login.html?registrado=local');
                        }
                    }
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
