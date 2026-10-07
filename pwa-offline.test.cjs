const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { indexedDB } = require('fake-indexeddb');
const { webcrypto } = require('node:crypto');

function client(account = 1) {
    const state = { connected: false, requests: [], failures: [], snapshot: { totalClientes: 1, totalMascotas: 0, totalUsuarios: 1, clientes: [{ id: 10, nombre: 'Ana', apellido: 'Pérez', email: 'ana@example.test' }], mascotas: [] } };
    const navigator = { get onLine() { return state.connected; } };
    const context = { indexedDB, crypto: webcrypto, structuredClone, atob, AbortSignal, TypeError, Error, CustomEvent, Event, navigator,
        location: { hostname: 'localhost', port: '3000' },
        sessionStorage: { getItem: () => 'x.' + btoa(JSON.stringify({ id: account })) + '.x' },
        document: { dispatchEvent() {} },
        fetch: async (url, options) => {
            if (url === '/api/sync') {
                const request = JSON.parse(options.body); state.requests.push(request);
                const failure = state.failures.shift();
                if (failure) return { ok: false, status: failure, json: async () => ({ mensaje: 'Conflicto de prueba' }) };
                return { ok: true, json: async () => ({ id: 20 }) };
            }
            return { ok: true, json: async () => state.snapshot };
        }, window: {} };
    vm.runInNewContext(fs.readFileSync('pwa/offline.js', 'utf8'), context);
    return { api: context.window.offlineApp, state };
}
test('cola offline persiste, aísla cuentas y conserva conflictos', async () => {
    const first = client(100);
    await first.api.write('100:/api/dashboard', first.state.snapshot);
    await first.api.write('100:/api/auth/sesion', { usuario: { id: 100, rol: 'cliente' } });
    const result = await first.api.mutate('pet:create', { cliente_id: 10, nombre: 'Sol', especie: 'perro' });
    assert.equal(result.pending, true);
    assert.equal((await first.api.get('/api/dashboard')).mascotas[0].nombre, 'Sol');
    const second = client(200);
    assert.equal((await second.api.pending()).length, 0);
    const reloaded = client(100);
    const id = (await reloaded.api.pending())[0].id;
    reloaded.state.connected = true; reloaded.state.failures.push(409);
    await reloaded.api.sync();
    assert.equal((await reloaded.api.pending())[0].error, 'Conflicto de prueba');
    assert.equal((await reloaded.api.pending())[0].id, id);
    await reloaded.api.discard(id);
    assert.equal((await reloaded.api.pending()).length, 0);
});
test('contraseñas nunca se guardan en IndexedDB', async () => {
    const { api, state } = client(300);
    await api.mutate('user:create', { nombre: 'Ana', email: 'ana@example.test', password: 'NeverStore123!' });
    const item = (await api.pending())[0];
    assert.equal(item.needsPassword, true);
    assert.equal(item.operation.values.password, undefined);
    state.connected = true;
    await api.sync();
    assert.equal(state.requests.length, 0);
    await api.complete(item.id, 'NeverStore123!');
    assert.equal(state.requests[0].password, 'NeverStore123!');
    assert.equal((await api.pending()).length, 0);
});
