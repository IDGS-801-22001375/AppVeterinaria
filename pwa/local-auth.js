(() => {
    const ITERATIONS = 210000;
    const encode = value => new TextEncoder().encode(value);
    const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
    const bytes = value => Uint8Array.from(value.match(/.{2}/g), pair => parseInt(pair, 16));
    let reconnecting = false;
    async function derive(password, salt, iterations = ITERATIONS) {
        const key = await crypto.subtle.importKey('raw', encode(password), 'PBKDF2', false, ['deriveBits']);
        return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salt), iterations }, key, 256));
    }
    async function verifier(password) {
        if (!crypto.subtle) throw new Error('El acceso offline requiere HTTPS o localhost.');
        const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
        return { salt, iterations: ITERATIONS, verifier: await derive(password, salt) };
    }
    async function verify(account, password) {
        const actual = await derive(password, account.salt, account.iterations);
        let mismatch = 0;
        for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ account.verifier.charCodeAt(i);
        if (mismatch) throw new Error('Correo o contraseña incorrectos.');
    }
    async function register(body) {
        const { values, errors } = authValidation.validate(body, 'register');
        if (Object.keys(errors).length) throw new Error(Object.values(errors).join('\n'));
        if (await offlineApp.read('auth:' + values.email)) throw new Error('Este correo ya está registrado en este dispositivo.');
        const registrationId = crypto.randomUUID();
        const namespace = 'account-' + crypto.randomUUID();
        const profile = { ...values }; delete profile.password;
        const usuario = { id: namespace, email: values.email, rol: 'cliente' };
        const account = { email: values.email, namespace, usuario, confirmed: false, registrationId, profile, ...await verifier(values.password) };
        const snapshot = { totalClientes: 1, totalMascotas: 0, totalUsuarios: 1, clientes: [{ ...profile, id: 'local:' + registrationId, usuario_id: namespace, pending: true }], mascotas: [] };
        const registration = { id: registrationId, owner: namespace, created: Date.now(), registration: true, needsPassword: true, operation: { id: registrationId, type: 'user:create', values: profile } };
        await offlineApp.createAccount(account, snapshot, registration);
        return { local: true, mensaje: 'Cuenta creada en este dispositivo. Ya puedes iniciar sesión sin conexión.' };
    }
    async function remember(body, data) {
        const email = body.email.trim().toLowerCase();
        const previous = await offlineApp.read('auth:' + email);
        const account = { ...previous, email, namespace: previous?.namespace || String(data.usuario.id), usuario: data.usuario, confirmed: true, ...await verifier(body.password) };
        sessionStorage.setItem('veterinaria.token', data.token);
        sessionStorage.setItem('veterinaria.local-email', email);
        await offlineApp.write(String(data.usuario.id) + ':/api/auth/sesion', { usuario: data.usuario });
        const snapshot = await offlineApp.get('/api/dashboard');
        await offlineApp.adoptAccount(account, data, snapshot);
    }
    function openLocal(account) {
        const token = 'local:' + account.namespace;
        sessionStorage.setItem('veterinaria.token', token);
        sessionStorage.setItem('veterinaria.local-email', account.email);
        return { local: true, token, usuario: account.usuario };
    }
    async function login(body) {
        const email = body.email.trim().toLowerCase();
        const account = await offlineApp.read('auth:' + email);
        if (account && !account.confirmed) {
            await verify(account, body.password);
            const local = openLocal(account);
            if (navigator.onLine) {
                try { return await reconnect(body.password); }
                catch (error) { document.dispatchEvent(new CustomEvent('offline:message', { detail: error.message })); }
            }
            return local;
        }
        if (navigator.onLine) {
            try {
                const data = await offlineApp.network('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                if (!data.token || !data.usuario) throw new Error('El servidor no devolvió una sesión válida.');
                try { await remember(body, data); }
                catch (error) { console.warn('No se pudo preparar esta cuenta offline:', error.message); sessionStorage.setItem('veterinaria.token', data.token); }
                return data;
            } catch (error) { if (error.status || !(error instanceof TypeError || error.name === 'TimeoutError' || error.name === 'AbortError')) throw error; }
        }
        if (!account) throw new Error('Esta cuenta no está guardada en este dispositivo. Regístrate sin conexión o entra una vez con conexión.');
        await verify(account, body.password);
        return openLocal(account);
    }
    async function reconnect(password) {
        if (reconnecting) throw new Error('Ya se está confirmando la cuenta.');
        if (!navigator.onLine) throw new Error('La cuenta local funciona sin internet. Conéctate para confirmarla en el servidor.');
        const email = sessionStorage.getItem('veterinaria.local-email');
        const account = await offlineApp.read('auth:' + email);
        if (!account || sessionStorage.getItem('veterinaria.token') !== 'local:' + account.namespace) throw new Error('Inicia sesión local antes de sincronizar.');
        await verify(account, password);
        reconnecting = true;
        try {
            if (!account.confirmed) {
                try { await offlineApp.network('/api/auth/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...account.profile, password }) }); }
                catch (error) { if (error.status !== 400) throw error; }
            }
            let data;
            try { data = await offlineApp.network('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }); }
            catch (error) { if (error.status === 401 && !account.confirmed) throw new Error('El correo ya existe en el servidor con otra contraseña. Tu cuenta y sus datos locales se conservan.'); throw error; }
            if (!data.token || !data.usuario) throw new Error('El servidor no devolvió una sesión válida.');
            const snapshot = await offlineApp.network('/api/dashboard', { headers: { Authorization: `Bearer ${data.token}` } });
            await offlineApp.adoptAccount(account, data, snapshot);
            sessionStorage.setItem('veterinaria.token', data.token);
            document.dispatchEvent(new Event('offline:changed'));
            return data;
        } catch (error) {
            account.syncError = error.message;
            await offlineApp.write('auth:' + email, account);
            throw error;
        } finally { reconnecting = false; }
    }
    window.localAuth = { register, login, remember, reconnect };
})();
