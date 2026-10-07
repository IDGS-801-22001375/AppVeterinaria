const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { existsSync } = require('node:fs');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'offline-browser-test-secret-at-least-32-bytes';

test('Registro y login offline: contraseña, logout, recarga y confirmación online', async t => {
    const app = require('./server'); const pool = require('./config/database');
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    let browser;
    t.after(async () => { await browser?.close(); await new Promise(resolve => server.close(resolve)); await pool.end(); });
    const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
    browser = await chromium.launch(executablePath ? { executablePath, headless: true } : { headless: true });
    const context = await browser.newContext(); const base = `http://127.0.0.1:${server.address().port}`;
    let disconnected = false;
    let remote;
    const pets = []; const requests = [];
    await context.route('**/api/**', async route => {
        if (disconnected) return route.abort('internetdisconnected');
        const request = route.request(); const path = new URL(request.url()).pathname;
        assert.ok(!request.headers().authorization?.includes('local:'), 'No enviar una sesión local al servidor');
        const body = request.method() === 'POST' ? request.postDataJSON() : null;
        if (path === '/api/auth/registro') {
            if (remote) return route.fulfill({ status: 400, json: { mensaje: 'El correo ya está registrado' } });
            remote = body; return route.fulfill({ status: 201, json: { mensaje: 'Registrado' } });
        }
        if (path === '/api/auth/login') {
            if (!remote || body.email !== remote.email || body.password !== remote.password) return route.fulfill({ status: 401, json: { mensaje: 'Correo o contraseña incorrectos' } });
            const usuario = { id: 101, email: remote.email, rol: 'cliente' };
            return route.fulfill({ json: { usuario, token: jwt.sign(usuario, process.env.JWT_SECRET) } });
        }
        if (path === '/api/auth/sesion') return route.fulfill({ json: { usuario: { id: 101, email: remote.email, rol: 'cliente' } } });
        if (path === '/api/dashboard') return route.fulfill({ json: { totalClientes: 1, totalMascotas: pets.length, totalUsuarios: 1, clientes: [{ id: 202, usuario_id: 101, ...remote, password: undefined }], mascotas: pets } });
        if (path === '/api/sync') {
            const op = body.operation; requests.push(op);
            assert.equal(op.values.cliente_id, 202, 'Reasignar al propietario real');
            pets.push({ ...op.values, id: 303, propietario: `${remote.nombre} ${remote.apellido}` });
            return route.fulfill({ json: { id: 303 } });
        }
        return route.fulfill({ status: 404, json: {} });
    });
    let page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/'); await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    disconnected = true; await context.setOffline(true);
    await page.goto(base + '/auth/register.html');
    const account = { nombre: 'Laura', apellido: 'Pérez', email: 'offline@example.test', password: 'Local$123!#' };
    for (const [name, value] of Object.entries(account)) await page.locator(`#${name}`).fill(value);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL('**/auth/login.html?registrado=local');
    assert.match(await page.locator('#auth-message').textContent(), /sin conexión/);
    await page.locator('#email').fill(account.email); await page.locator('#password').fill('Incorrecta123!');
    await page.locator('form button[type="submit"]').click();
    await page.waitForFunction(() => document.getElementById('auth-message').textContent.includes('incorrectos'));
    assert.ok(page.url().includes('login.html'));
    await page.locator('#password').fill(account.password); await page.locator('form button[type="submit"]').click();
    await page.waitForURL('**/dashboard/dashboard.html');
    await page.waitForFunction(() => document.getElementById('tablaClientes').textContent.includes('Laura'));
    assert.match(await page.locator('#session-user').textContent(), /offline@example.test/);
    const record = await page.evaluate(() => offlineApp.read('auth:offline@example.test'));
    assert.equal(record.confirmed, false); assert.equal(record.verifier.length, 64); assert.equal(record.salt.length, 32);
    assert.ok(!JSON.stringify(record).includes(account.password));
    await page.locator('#register-pet').click(); await page.locator('#pet-form input[name="nombre"]').fill('Luna local'); await page.locator('#pet-form button[type="submit"]').click();
    await page.waitForFunction(() => document.getElementById('tablaMascotas').textContent.includes('Luna local'));
    await page.locator('#logout').click(); await page.waitForURL('**/auth/login.html');
    await page.close(); page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/auth/login.html');
    await page.locator('#email').fill(account.email); await page.locator('#password').fill(account.password); await page.locator('form button[type="submit"]').click();
    await page.waitForURL('**/dashboard/dashboard.html');
    await page.waitForFunction(() => document.getElementById('tablaMascotas').textContent.includes('Luna local'));
    disconnected = false; await context.setOffline(false);
    await page.locator('#local-password').fill(account.password); await page.locator('#confirm-account').click();
    await page.waitForFunction(() => !sessionStorage.getItem('veterinaria.token').startsWith('local:'));
    await page.waitForFunction(async () => (await offlineApp.pending()).length === 0);
    assert.equal(requests.length, 1); assert.equal(pets[0].nombre, 'Luna local');
    assert.equal((await page.evaluate(() => offlineApp.read('auth:offline@example.test'))).confirmed, true);
    await page.locator('#logout').click(); await page.waitForURL('**/auth/login.html');
    disconnected = true; await context.setOffline(true);
    await page.locator('#email').fill(account.email); await page.locator('#password').fill(account.password); await page.locator('form button[type="submit"]').click();
    await page.waitForURL('**/dashboard/dashboard.html'); await page.waitForFunction(() => document.getElementById('tablaMascotas').textContent.includes('Luna local'));
    assert.deepEqual(errors, []);
});
