const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcrypt');

test('JSON: registro, persistencia, login y sesión real', async (t) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'veterinaria-auth-'));
    const file = path.join(directory, 'usuarios.json');
    await fs.copyFile(path.join(__dirname, 'data/usuarios.json'), file);
    process.env.DB_DRIVER = 'json';
    process.env.JSON_DB_PATH = file;
    process.env.JWT_SECRET = 'test-only-secret';
    const app = require('./server');
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        await fs.rm(directory, { recursive: true, force: true });
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (route, body) => fetch(base + '/api/auth/' + route, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const user = { email: 'new@example.test', password: 'Example123!', nombre: 'Ana', apellido: 'Pérez', telefono: '5551234567' };

    await t.test('cuenta demo y contraseña incorrecta', async () => {
        assert.equal((await post('login', { email: 'demo@veterinaria.test', password: 'Demo1234!' })).status, 200);
        assert.equal((await post('login', { ...user, password: 'incorrecta' })).status, 401);
    });
    await t.test('registro persiste cuenta cifrada y perfil relacionado', async () => {
        assert.equal((await post('registro', user)).status, 201);
        const data = JSON.parse(await fs.readFile(file, 'utf8'));
        const saved = data.usuarios.find((row) => row.email === user.email);
        assert.equal(await bcrypt.compare(user.password, saved.password_hash), true);
        assert.equal(saved.password, undefined);
        assert.equal(saved.activo, 1);
        const profile = data.clientes.find((row) => row.usuario_id === saved.id);
        assert.equal(profile.nombre, user.nombre);
        assert.equal(profile.telefono, user.telefono);
        assert.equal(profile.direccion, null);
        // Un adaptador recién cargado lee el registro desde disco.
        delete require.cache[require.resolve('./repositories/jsonAuthRepository')];
        assert.equal((await require('./repositories/jsonAuthRepository').findByEmail(user.email)).id, saved.id);
    });
    await t.test('login emite JWT que autoriza sesión y no expone hash', async () => {
        const response = await post('login', user);
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.equal(data.usuario.password_hash, undefined);
        const session = await fetch(base + '/api/auth/sesion', { headers: { Authorization: `Bearer ${data.token}` } });
        assert.equal(session.status, 200);
        assert.equal((await session.json()).usuario.email, user.email);
        assert.equal((await fetch(base + '/api/auth/sesion')).status, 401);
        assert.equal((await fetch(base + '/auth/prueba.html')).status, 200);
        assert.equal((await fetch(base + '/data/usuarios.json')).status, 404);
    });
    await t.test('duplicados concurrentes no crean filas parciales', async () => {
        const parallel = { ...user, email: 'parallel@example.test' };
        const responses = await Promise.all([post('registro', parallel), post('registro', parallel)]);
        assert.deepEqual(responses.map((response) => response.status).sort(), [201, 400]);
        assert.equal((await post('registro', { ...user, email: user.email.toUpperCase() })).status, 400);
        const data = JSON.parse(await fs.readFile(file, 'utf8'));
        assert.equal(data.usuarios.filter((row) => row.email === parallel.email).length, 1);
        assert.equal(data.usuarios.length, data.clientes.length);
    });
    await t.test('validación y cuenta desactivada', async () => {
        assert.equal((await post('registro', {})).status, 400);
        assert.equal((await post('login', {})).status, 400);
        assert.equal((await post('login', { ...user, password: 'incorrecta' })).status, 401);
        const data = JSON.parse(await fs.readFile(file, 'utf8'));
        data.usuarios.find((row) => row.email === user.email).activo = 0;
        await fs.writeFile(file, JSON.stringify(data));
        assert.equal((await post('login', user)).status, 403);
    });
});
