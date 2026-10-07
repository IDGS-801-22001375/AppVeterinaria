(() => {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && location.port === '5500';
    const origin = local ? `${location.protocol}//${location.hostname}:3000` : '';
    let database;
    function db() {
        if (!database) database = new Promise((resolve, reject) => {
            const request = indexedDB.open('huellitas-offline', 1);
            request.onupgradeneeded = () => { request.result.createObjectStore('cache'); request.result.createObjectStore('queue', { keyPath: 'id' }); };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return database;
    }
    async function store(name, mode, run) {
        const database = await db();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(name, mode);
            const request = run(transaction.objectStore(name));
            transaction.oncomplete = () => resolve(request.result);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    }
    const read = key => store('cache', 'readonly', s => s.get(key));
    const write = (key, value) => store('cache', 'readwrite', s => s.put(value, key));
    const queueAll = () => store('queue', 'readonly', s => s.getAll());
    function owner() {
        const token = sessionStorage.getItem('veterinaria.token');
        if (!token) return 'public';
        if (token.startsWith('local:')) return token.slice(6);
        try { return String(JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).id); }
        catch { return 'public'; }
    }
    async function network(url, options = {}) {
        if (!navigator.onLine) throw new TypeError('Sin conexión');
        const response = await fetch(origin + url, { ...options, cache: 'no-store', signal: AbortSignal.timeout(10000) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw Object.assign(new Error(data.mensaje || 'No se pudo completar la solicitud.'), { status: response.status });
        return data;
    }
    const headers = () => ({ Authorization: `Bearer ${sessionStorage.getItem('veterinaria.token')}` });
    async function pending() { const account = owner(); return (await queueAll()).filter(item => item.owner === account || item.owner === 'public').sort((a, b) => a.created - b.created); }
    async function overlay(snapshot) {
        const data = structuredClone(snapshot);
        const operations = (await pending()).filter(item => item.owner === owner() && !item.error);
        const session = await read(owner() + ':/api/auth/sesion');
        for (const item of operations) {
            const operation = item.operation;
            const isPet = operation.type.startsWith('pet:');
            const collection = isPet ? data.mascotas : data.clientes;
            if (operation.type.endsWith(':create')) {
                if (!isPet && session?.usuario.rol !== 'admin') continue;
                const client = data.clientes.find(c => String(c.id) === String(operation.values.cliente_id));
                collection.unshift({ ...operation.values, id: 'local:' + operation.id, pending: true, propietario: client ? `${client.nombre} ${client.apellido}` : 'Pendiente' });
            } else {
                const row = collection.find(row => String(row.id) === String(operation.target));
                if (row) Object.assign(row, operation.values, { pending: true });
            }
        }
        data.totalClientes = data.clientes.length;
        data.totalMascotas = data.mascotas.length;
        return data;
    }
    async function get(url) {
        const key = owner() + ':' + url;
        let data;
        try {
            if (sessionStorage.getItem('veterinaria.token')?.startsWith('local:')) throw new TypeError('Sesión local');
            data = await network(url, { headers: headers() }); await write(key, data);
        }
        catch (error) {
            if (error.status && error.status < 500) throw error;
            data = await read(key);
            if (!data) throw new Error('Abre esta sección con conexión una vez para tener sus datos disponibles offline.');
        }
        return url === '/api/dashboard' ? overlay(data) : data;
    }
    async function replaceReferences(account, localId, result) {
        for (const item of await queueAll()) {
            if (item.owner !== account) continue;
            if (item.operation.target === localId) item.operation.target = result.cliente_id || result.id;
            if (item.operation.values.cliente_id === localId) item.operation.values.cliente_id = result.cliente_id;
            if (item.operation.base?.cliente_id === localId) item.operation.base.cliente_id = result.cliente_id;
            await store('queue', 'readwrite', s => s.put(item));
        }
    }
    let syncing = false;
    const secrets = new Map();
    async function drain() {
        if (syncing || !navigator.onLine) return;
        if (sessionStorage.getItem('veterinaria.token')?.startsWith('local:')) {
            document.dispatchEvent(new CustomEvent('offline:message', { detail: 'Sesión local activa. Confirma tu contraseña en Validar cuenta para sincronizar con el servidor.' }));
            return;
        }
        syncing = true;
        try {
            for (const queued of await pending()) {
                const item = await store('queue', 'readonly', s => s.get(queued.id));
                if (!item || (item.owner !== 'public' && item.owner !== owner())) continue;
                if (item.error) break;
                const password = secrets.get(item.id);
                if (item.needsPassword && !password) break;
                try {
                    const data = await network('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(item.owner === 'public' ? {} : headers()) }, body: JSON.stringify({ operation: item.operation, ...(password ? { password } : {}) }) });
                    await replaceReferences(item.owner, 'local:' + item.id, data);
                    const snapshotKey = item.owner + ':/api/dashboard';
                    const snapshot = await read(snapshotKey);
                    if (snapshot) {
                        const operation = item.operation;
                        const collection = operation.type.startsWith('pet:') ? snapshot.mascotas : snapshot.clientes;
                        if (operation.type.endsWith(':create')) {
                            const session = await read(item.owner + ':/api/auth/sesion');
                            if (operation.type.startsWith('pet:') || session?.usuario.rol === 'admin') {
                                const client = snapshot.clientes.find(c => String(c.id) === String(operation.values.cliente_id));
                                collection.unshift({ ...operation.values, id: operation.type.startsWith('pet:') ? data.id : data.cliente_id, usuario_id: data.id, propietario: client ? `${client.nombre} ${client.apellido}` : '' });
                            }
                        } else {
                            const record = collection.find(row => String(row.id) === String(operation.target));
                            if (record) Object.assign(record, operation.values);
                        }
                        snapshot.totalClientes = snapshot.clientes.length;
                        snapshot.totalMascotas = snapshot.mascotas.length;
                    }
                    const database = await db();
                    await new Promise((resolve, reject) => {
                        const transaction = database.transaction(['cache', 'queue'], 'readwrite');
                        if (snapshot) transaction.objectStore('cache').put(snapshot, snapshotKey);
                        transaction.objectStore('queue').delete(item.id);
                        transaction.oncomplete = resolve;
                        transaction.onerror = () => reject(transaction.error);
                    });
                    secrets.delete(item.id);
                    // Invalida la instantánea después de guardar; se volverá a leer del servidor.
                    try { const fresh = await network('/api/dashboard', { headers: headers() }); await write(owner() + ':/api/dashboard', fresh); } catch {}
                } catch (error) {
                    if (error.status && ![401, 403].includes(error.status) && error.status < 500) { item.error = error.message; await store('queue', 'readwrite', s => s.put(item)); }
                    document.dispatchEvent(new CustomEvent('offline:message', { detail: error.message }));
                    break;
                }
            }
        } finally { syncing = false; document.dispatchEvent(new Event('offline:changed')); }
    }
    async function sync() {
        if (navigator.locks) return navigator.locks.request('huellitas-sync', drain);
        return drain();
    }
    async function mutate(type, values, target, base) {
        const password = values.password || '';
        const clean = { ...values };
        delete clean.password;
        const id = crypto.randomUUID();
        const item = { id, owner: owner(), created: Date.now(), operation: { id, type, values: clean, ...(target != null ? { target, base } : {}) }, needsPassword: type === 'user:create' || Boolean(password) };
        await store('queue', 'readwrite', s => s.put(item));
        if (password && navigator.onLine) secrets.set(id, password);
        await sync();
        const saved = await store('queue', 'readonly', s => s.get(id));
        if (saved?.error) throw new Error(saved.error + ' Revisa el panel de cambios pendientes.');
        return { pending: Boolean(saved), mensaje: saved ? 'Guardado en este dispositivo. Pendiente de sincronizar.' : 'Guardado y sincronizado.' };
    }
    async function discard(id) {
        await store('queue', 'readwrite', s => s.delete(id));
        secrets.delete(id);
        document.dispatchEvent(new Event('offline:changed'));
    }
    async function complete(id, password) {
        const item = await store('queue', 'readonly', s => s.get(id));
        if (item?.registration && sessionStorage.getItem('veterinaria.token')?.startsWith('local:')) {
            await localAuth.reconnect(password);
        } else secrets.set(id, password);
        await sync();
    }
    async function createAccount(account, snapshot, registration) {
        const database = await db();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(['cache', 'queue'], 'readwrite');
            tx.objectStore('cache').add(account, 'auth:' + account.email);
            tx.objectStore('cache').put(snapshot, account.namespace + ':/api/dashboard');
            tx.objectStore('cache').put({ usuario: account.usuario, local: true }, account.namespace + ':/api/auth/sesion');
            tx.objectStore('queue').add(registration);
            tx.oncomplete = resolve;
            tx.onabort = () => reject(new Error('Este correo ya está registrado en este dispositivo.'));
            tx.onerror = () => {};
        });
    }
    async function adoptAccount(account, data, snapshot) {
        const old = account.namespace;
        const database = await db();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(['cache', 'queue'], 'readwrite');
            const cache = tx.objectStore('cache');
            const queue = tx.objectStore('queue');
            const request = queue.getAll();
            request.onsuccess = () => {
                const client = snapshot.clientes.find(c => c.usuario_id === data.usuario.id);
                for (const item of request.result) {
                    if (item.owner !== old) continue;
                    if (item.id === account.registrationId) { queue.delete(item.id); continue; }
                    item.owner = String(data.usuario.id);
                    const localClient = 'local:' + account.registrationId;
                    if (client && item.operation.values.cliente_id === localClient) item.operation.values.cliente_id = client.id;
                    if (client && item.operation.target === localClient) item.operation.target = client.id;
                    if (client && item.operation.base?.cliente_id === localClient) item.operation.base.cliente_id = client.id;
                    if (client && item.operation.type === 'user:update' && item.operation.base?.id === localClient) {
                        const original = { ...item.operation.base, id: client.id, usuario_id: data.usuario.id };
                        item.operation.base = original;
                    }
                    queue.put(item);
                }
                account = { ...account, namespace: String(data.usuario.id), usuario: data.usuario, confirmed: true, syncError: '' };
                cache.put(account, 'auth:' + account.email);
                cache.put(snapshot, account.namespace + ':/api/dashboard');
                cache.put({ usuario: data.usuario }, account.namespace + ':/api/auth/sesion');
            };
            tx.oncomplete = () => resolve(account);
            tx.onabort = () => reject(tx.error);
            tx.onerror = () => {};
        });
    }
    window.offlineApp = { get, mutate, sync, pending, discard, complete, network, owner, write, read, createAccount, adoptAccount };
})();
