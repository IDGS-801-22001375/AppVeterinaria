const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('auth/js/auth.js', 'utf8');

function setup(response, mode = 'login', origin = 'http://localhost:3000') {
    const page = new URL(origin);
    const message = { textContent: '', hidden: true };
    const button = { disabled: true, textContent: 'Enviar' };
    let submit;
    const form = {
        dataset: { auth: mode }, action: origin + '/api/auth/' + (mode === 'login' ? 'login' : 'registro'),
        reportValidity: () => true, querySelector: () => button,
        setAttribute() {}, removeAttribute() {},
        addEventListener: (_, callback) => { submit = callback; }
    };
    const state = { message, button, form, token: null, redirect: null, request: null };
    vm.runInNewContext(source, {
        document: { getElementById: () => message, querySelector: (selector) => selector === 'form[data-auth]' ? form : null },
        location: { origin, hostname: page.hostname, port: page.port, protocol: page.protocol, search: '', replace: (url) => { state.redirect = url; } },
        sessionStorage: { setItem: (_, value) => { state.token = value; } },
        FormData: class { *[Symbol.iterator]() { yield ['email', ' test@example.com ']; yield ['password', ' secret ']; } },
        URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
        fetch: async (url, options) => { state.request = { url, ...options }; return response; }
    });
    state.submit = () => submit({ preventDefault() { state.prevented = true; } });
    return state;
}

test('login sends JSON, preserves password and redirects with token', async () => {
    const state = setup({ ok: true, json: async () => ({ token: 'test-token' }) });
    await state.submit();
    assert.deepEqual(JSON.parse(state.request.body), { email: 'test@example.com', password: ' secret ' });
    assert.equal(state.token, 'test-token');
    assert.equal(state.redirect, '/auth/prueba.html');
    assert.equal(state.button.disabled, false);
});

test('invalid credentials display backend message without redirect', async () => {
    const state = setup({ ok: false, status: 401, json: async () => ({ mensaje: 'Correo o contraseña incorrectos' }) });
    await state.submit();
    assert.equal(state.message.textContent, 'Correo o contraseña incorrectos');
    assert.equal(state.redirect, null);
    assert.equal(state.token, null);
    assert.equal(state.button.disabled, false);
});

test('missing token is rejected', async () => {
    const state = setup({ ok: true, json: async () => ({}) });
    await state.submit();
    assert.equal(state.redirect, null);
    assert.match(state.message.textContent, /sesión válida/);
});

test('successful registration redirects to login', async () => {
    const state = setup({ ok: true, json: async () => ({ mensaje: 'Creado' }) }, 'register');
    await state.submit();
    assert.equal(state.request.url, '/api/auth/registro');
    assert.equal(state.redirect, '/auth/login.html?registrado=1');
    assert.equal(state.token, null);
});

test('Live Server sends login and registration to Express, keeping navigation on frontend', async () => {
    for (const mode of ['login', 'register']) {
        const state = setup({ ok: true, json: async () => ({ token: 'test-token' }) }, mode, 'http://127.0.0.1:5500');
        await state.submit();
        assert.equal(state.request.url, 'http://127.0.0.1:3000/api/auth/' + (mode === 'login' ? 'login' : 'registro'));
        assert.ok(state.redirect.startsWith('/auth/'));
    }
});

test('deployment keeps its own API origin', async () => {
    const state = setup({ ok: true, json: async () => ({ token: 'test-token' }) }, 'login', 'https://veterinaria.example');
    await state.submit();
    assert.equal(state.request.url, '/api/auth/login');
});

test('registration ignores a legacy form action and prevents native submission', async () => {
    const state = setup({ ok: true, json: async () => ({}) }, 'register', 'http://127.0.0.1:5500');
    state.form.action = 'http://127.0.0.1:5500/register';
    assert.equal(state.button.disabled, false);
    await state.submit();
    assert.equal(state.prevented, true);
    assert.equal(state.request.url, 'http://127.0.0.1:3000/api/auth/registro');
    assert.equal(state.redirect, '/auth/login.html?registrado=1');
});
