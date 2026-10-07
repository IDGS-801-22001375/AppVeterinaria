const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcrypt');
require('dotenv').config();

test('MySQL real: registro, duplicados, persistencia, login y sesión', async (t) => {
    const pool = require('./config/database');
    let server;
    const prefix = randomUUID();
    const emails = [`test-${prefix}@example.test`, `parallel-${prefix}@example.test`];
    t.after(async () => {
        try {
            await pool.execute('DELETE FROM usuarios WHERE email IN (?, ?)', emails);
        } finally {
            if (server) await new Promise((resolve) => server.close(resolve));
            await pool.end();
        }
    });
    await pool.query('SELECT id FROM usuarios LIMIT 0');
    const app = require('./server');
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (route, body) => fetch(base + '/api/auth/' + route, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const user = { email: emails[0], password: 'TestPassword123!', nombre: 'Prueba', apellido: 'Integración' };
    assert.equal((await post('registro', user)).status, 201);
    const [rows] = await pool.execute(
        'SELECT u.*, c.usuario_id, c.nombre FROM usuarios u JOIN clientes c ON c.usuario_id = u.id WHERE u.email = ?', [user.email]
    );
    assert.equal(rows.length, 1);
    assert.equal(await bcrypt.compare(user.password, rows[0].password_hash), true);
    assert.equal(rows[0].usuario_id, rows[0].id);
    assert.equal((await post('login', { ...user, password: 'incorrecta' })).status, 401);
    const login = await post('login', user);
    assert.equal(login.status, 200);
    const data = await login.json();
    assert.equal(data.usuario.password_hash, undefined);
    const headers = { Authorization: `Bearer ${data.token}` };
    const session = await fetch(base + '/api/auth/sesion', { headers });
    assert.equal(session.status, 200);
    assert.equal((await session.json()).usuario.email, user.email);
    assert.equal((await fetch(base + '/dashboard/dashboard.html')).status, 200);
    assert.equal((await fetch(base + '/api/dashboard')).status, 401);
    const dashboardResponse = await fetch(base + '/api/dashboard', { headers });
    assert.equal(dashboardResponse.status, 200);
    const dashboard = await dashboardResponse.json();
    assert.equal(dashboard.totalClientes, 1);
    assert.equal(dashboard.totalUsuarios, 1);
    assert.equal(dashboard.clientes[0].email, user.email);
    for (const route of ['/mascotas/mascotas.js', '/usuarios/usuarios.js', '/sidebar/sidebar.js']) assert.equal((await fetch(base + route)).status, 200);
    const createPet = (body, auth = headers) => fetch(base + '/api/mascotas', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const pet = { cliente_id: dashboard.clientes[0].id, nombre: 'Mascota de prueba', especie: 'perro', sexo: 'hembra', fecha_nacimiento: '2022-03-04' };
    assert.equal((await createPet(pet, {})).status, 401);
    assert.equal((await createPet({ ...pet, sexo: 'otro' })).status, 400);
    assert.equal((await createPet({ ...pet, fecha_nacimiento: '2024-02-30' })).status, 400);
    const petResponse = await createPet(pet);
    assert.equal(petResponse.status, 201);
    const petId = (await petResponse.json()).id;
    const updatedDashboard = await (await fetch(base + '/api/dashboard', { headers })).json();
    assert.equal(updatedDashboard.totalMascotas, 1);
    assert.equal(updatedDashboard.mascotas[0].id, petId);
    const parallel = { ...user, email: emails[1] };
    const responses = await Promise.all([post('registro', parallel), post('registro', parallel)]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 400]);
    const [counts] = await pool.execute('SELECT COUNT(*) AS total FROM clientes c JOIN usuarios u ON u.id = c.usuario_id WHERE u.email = ?', [emails[1]]);
    assert.equal(counts[0].total, 1);
    const [otherClients] = await pool.execute('SELECT c.id FROM clientes c JOIN usuarios u ON u.id = c.usuario_id WHERE u.email = ?', [emails[1]]);
    assert.equal((await createPet({ ...pet, cliente_id: otherClients[0].id })).status, 403);
    await pool.execute('UPDATE usuarios SET activo = 0 WHERE email = ?', [user.email]);
    assert.equal((await post('login', user)).status, 403);
    assert.equal((await fetch(base + '/api/auth/sesion', { headers })).status, 401);
});
