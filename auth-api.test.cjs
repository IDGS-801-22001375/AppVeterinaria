const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
process.env.JWT_SECRET = 'test-secret-with-at-least-32-bytes-for-tests';

// Sustituye solo la conexión durante estas pruebas; producción siempre usa MySQL.
const users = new Map();
let nextId = 1;
let failProfile = false;
let transaction;
const connection = {
    async beginTransaction() { transaction = null; },
    async execute(sql, params) {
        if (sql.startsWith('INSERT INTO usuarios')) {
            if ([...users.values()].some((user) => user.email === params[0])) {
                throw Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' });
            }
            transaction = { id: nextId++, email: params[0], password_hash: params[1], rol: 'cliente', activo: 1 };
            return [{ insertId: transaction.id }];
        }
        if (failProfile) throw new Error('Profile insert failed');
        transaction.profile = params;
        return [{ affectedRows: 1 }];
    },
    async commit() { users.set(transaction.id, transaction); transaction = null; },
    async rollback() { transaction = null; },
    release() {}
};
const pool = {
    async execute(sql, params) {
        if (sql.includes('WHERE email')) return [[...users.values()].filter((user) => user.email === params[0])];
        return [[...users.values()].filter((user) => user.id === params[0])];
    },
    async getConnection() { return connection; }
};
require.cache[require.resolve('./config/database')] = { exports: pool };

test('API y repositorio MySQL: registro, login, sesión y rollback', async (t) => {
    const app = require('./server');
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (route, body) => fetch(base + '/api/auth/' + route, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const user = { email: 'ana@example.test', password: 'Example123!', nombre: 'Ana', apellido: 'Pérez', telefono: '5551234567' };
    let token;
    await t.test('registro guarda bcrypt y perfil relacionado', async () => {
        assert.equal((await post('registro', user)).status, 201);
        const saved = [...users.values()][0];
        assert.equal(await bcrypt.compare(user.password, saved.password_hash), true);
        assert.deepEqual(saved.profile, [saved.id, user.nombre, user.apellido, user.telefono, null]);
        assert.equal((await post('registro', { ...user, email: user.email.toUpperCase() })).status, 400);
    });
    await t.test('login y sesión validan JWT sin exponer hash', async () => {
        const response = await post('login', user);
        assert.equal(response.status, 200);
        const data = await response.json();
        token = data.token;
        assert.equal(data.usuario.password_hash, undefined);
        const session = await fetch(base + '/api/auth/sesion', { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(session.status, 200);
        assert.equal((await session.json()).usuario.email, user.email);
        assert.equal((await fetch(base + '/api/auth/sesion')).status, 401);
        assert.equal((await fetch(base + '/data/usuarios.json')).status, 404);
    });
    await t.test('validación, contraseña incorrecta y usuario inactivo', async () => {
        assert.equal((await post('registro', {})).status, 400);
        assert.equal((await post('registro', { ...user, nombre: 'a'.repeat(81) })).status, 400);
        assert.equal((await post('registro', { ...user, password: 'a'.repeat(73) })).status, 400);
        assert.equal((await post('login', { ...user, password: 'incorrecta' })).status, 401);
        [...users.values()][0].activo = 0;
        assert.equal((await post('login', user)).status, 403);
        assert.equal((await fetch(base + '/api/auth/sesion', { headers: { Authorization: `Bearer ${token}` } })).status, 401);
    });
    await t.test('fallo al crear perfil revierte el usuario', async () => {
        failProfile = true;
        assert.equal((await post('registro', { ...user, email: 'rollback@example.test' })).status, 500);
        assert.equal(users.size, 1);
        assert.equal(transaction, null);
    });
});
