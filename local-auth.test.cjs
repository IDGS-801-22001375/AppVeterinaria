const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { indexedDB } = require('fake-indexeddb');
const { webcrypto } = require('node:crypto');

function setup() {
    const state = { connected: false, rejectLogin: false, calls: [] };
    const session = new Map();
    const context = {
        indexedDB, crypto: webcrypto, TextEncoder, Uint8Array, structuredClone, atob, AbortSignal, TypeError, Error, CustomEvent, Event,
        location: { hostname: 'localhost', port: '3000' },
        navigator: { get onLine() { return state.connected; } },
        sessionStorage: { getItem: key => session.get(key) || null, setItem: (key, value) => session.set(key, value), removeItem: key => session.delete(key) },
        document: { dispatchEvent() {} }, console,
        fetch: async (url, options) => {
            state.calls.push({ url, options });
            if (state.rejectLogin) return { ok: false, status: 401, json: async () => ({ mensaje: 'Correo o contraseña incorrectos' }) };
            if (url === '/api/dashboard') return { ok: true, json: async () => ({ totalClientes: 1, totalMascotas: 0, totalUsuarios: 1, clientes: [{ id: 10, usuario_id: 100, email: 'verified@example.test', nombre: 'Cuenta', apellido: 'Real' }], mascotas: [] }) };
            return { ok: true, json: async () => ({ token: 'x.' + btoa(JSON.stringify({ id: 100 })) + '.x', usuario: { id: 100, email: 'verified@example.test', rol: 'cliente' } }) };
        }
    };
    context.window = context;
    vm.createContext(context);
    for (const file of ['auth/js/validation.js', 'pwa/offline.js', 'pwa/local-auth.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
    return { auth: context.localAuth, api: context.offlineApp, state, session };
}

test('cuentas locales: duplicados, verificador persistente, logout y aislamiento', async () => {
    const { auth, api, session } = setup();
    const user = { nombre: 'Ana', apellido: 'Pérez', email: 'local-one@example.test', password: 'LocalPassword123!' };
    await auth.register(user);
    await assert.rejects(auth.register(user), /ya está registrado/);
    await assert.rejects(auth.login({ ...user, password: 'incorrecta' }), /incorrectos/);
    assert.equal(session.has('veterinaria.token'), false);
    const first = await auth.login(user);
    assert.equal(first.local, true);
    const data = await api.get('/api/dashboard');
    assert.equal(data.clientes[0].email, user.email);
    await api.mutate('pet:create', { nombre: 'Luna', especie: 'perro', cliente_id: data.clientes[0].id });
    assert.equal((await api.get('/api/dashboard')).mascotas.length, 1);
    session.delete('veterinaria.token');
    await auth.login(user);
    assert.equal((await api.get('/api/dashboard')).mascotas.length, 1);
    const other = { ...user, email: 'local-two@example.test' };
    await auth.register(other); await auth.login(other);
    assert.equal((await api.get('/api/dashboard')).mascotas.length, 0);
    const saved = await api.read('auth:' + user.email);
    const second = await api.read('auth:' + other.email);
    assert.notEqual(saved.salt, second.salt);
    assert.notEqual(saved.verifier, second.verifier);
    assert.ok(!JSON.stringify(saved).includes(user.password));
    await assert.rejects(auth.login({ email: 'unknown@example.test', password: 'Password123!' }), /no está guardada/);
});
test('cuenta online: preparar offline; no ignorar rechazo 401 del servidor', async () => {
    const { auth, api, state, session } = setup();
    state.connected = true;
    const user = { email: 'verified@example.test', password: 'Verified123!' };
    const result = await auth.login(user);
    assert.equal(result.usuario.id, 100);
    assert.equal((await api.read('auth:' + user.email)).confirmed, true);
    session.delete('veterinaria.token'); state.rejectLogin = true;
    await assert.rejects(auth.login(user), /incorrectos/);
    assert.equal(session.has('veterinaria.token'), false);
    state.connected = false;
    const local = await auth.login(user);
    assert.equal(local.local, true);
    assert.equal((await api.get('/api/dashboard')).clientes[0].email, user.email);
});
