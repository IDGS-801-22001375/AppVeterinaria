const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('auth/js/validation.js', 'utf8') + '\n' + fs.readFileSync('auth/js/auth.js', 'utf8');

function setup(response, mode = 'login', origin = 'http://localhost:3000', submitted) {
    const page = new URL(origin);
    const message = { textContent: '', hidden: true, dataset: {}, setAttribute() {} };
    const button = { disabled: true, textContent: 'Enviar' };
    const values = submitted || { email: ' test@example.com ', password: ' secret123 ', ...(mode === 'register' ? { nombre: 'Ana', apellido: 'Pérez', telefono: '' } : {}) };
    const fields = Object.keys(values).map(name => ({ name, invalid: false, setAttribute() { this.invalid = true; }, removeAttribute() { this.invalid = false; }, focus() { this.focused = true; } }));
    let submit;
    const form = {
        dataset: { auth: mode }, action: origin + '/api/auth/' + (mode === 'login' ? 'login' : 'registro'),
        querySelector: selector => selector === 'button[type="submit"]' ? button : fields.find(field => field.invalid),
        querySelectorAll: () => fields,
        setAttribute() {}, removeAttribute() {},
        addEventListener: (_, callback) => { submit = callback; }
    };
    const state = { message, button, form, fields, token: null, redirect: null, request: null };
    vm.runInNewContext(source, {
        document: { getElementById: () => message, querySelector: selector => selector === 'form[data-auth]' ? form : null },
        location: { origin, hostname: page.hostname, port: page.port, protocol: page.protocol, search: '', replace: url => { state.redirect = url; } },
        sessionStorage: { setItem: (_, value) => { state.token = value; } },
        FormData: class { *[Symbol.iterator]() { yield* Object.entries(values); } },
        navigator: { onLine: true }, URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
        fetch: async (url, options) => { state.request = { url, ...options }; return response; }
    });
    state.submit = () => submit({ preventDefault() { state.prevented = true; } });
    return state;
}

test('login envía JSON, conserva contraseña y redirige al dashboard', async () => {
    const state = setup({ ok: true, json: async () => ({ token: 'test-token' }) });
    await state.submit();
    assert.deepEqual(JSON.parse(state.request.body), { email: 'test@example.com', password: ' secret123 ' });
    assert.equal(state.token, 'test-token');
    assert.equal(state.redirect, '/dashboard/dashboard.html');
    assert.equal(state.button.disabled, false);
});
test('credenciales incorrectas muestran error sin redirigir', async () => {
    const state = setup({ ok: false, status: 401, json: async () => ({ mensaje: 'Correo o contraseña incorrectos' }) });
    await state.submit();
    assert.equal(state.message.textContent, 'Correo o contraseña incorrectos');
    assert.equal(state.redirect, null);
    assert.equal(state.token, null);
});
test('respuesta sin token no permite entrar al dashboard', async () => {
    const state = setup({ ok: true, json: async () => ({}) });
    await state.submit();
    assert.equal(state.redirect, null);
    assert.match(state.message.textContent, /sesión válida/);
});
test('registro correcto permite teléfono opcional y lleva al login', async () => {
    const state = setup({ ok: true, json: async () => ({ mensaje: 'Creado' }) }, 'register');
    await state.submit();
    assert.equal(state.request.url, '/api/auth/registro');
    assert.equal(state.redirect, '/auth/login.html?registrado=1');
    assert.equal(state.token, null);
});
test('Live Server mantiene API y navegación correctas', async () => {
    for (const mode of ['login', 'register']) {
        const state = setup({ ok: true, json: async () => ({ token: 'test-token' }) }, mode, 'http://127.0.0.1:5500');
        await state.submit();
        assert.equal(state.request.url, 'http://127.0.0.1:3000/api/auth/' + (mode === 'login' ? 'login' : 'registro'));
        assert.equal(state.redirect, mode === 'login' ? '/dashboard/dashboard.html' : '/auth/login.html?registrado=1');
    }
});
test('entrada inválida muestra errores y no envía la petición', async () => {
    const state = setup({}, 'register', 'http://localhost:3000', { email: 'incorrecto', password: 'corta', nombre: '123', apellido: '', telefono: 'abc' });
    await state.submit();
    assert.equal(state.request, null);
    assert.equal(state.redirect, null);
    assert.equal(state.message.dataset.type, 'error');
    assert.match(state.message.textContent, /correo electrónico válido/);
    assert.match(state.message.textContent, /8 caracteres/);
    assert.match(state.message.textContent, /teléfono/);
    assert.equal(state.fields[0].focused, true);
});
test('login vacío no envía la petición y muestra campos obligatorios', async () => {
    const state = setup({}, 'login', 'http://localhost:3000', { email: '', password: ' ' });
    await state.submit();
    assert.equal(state.request, null);
    assert.match(state.message.textContent, /correo electrónico/);
    assert.match(state.message.textContent, /contraseña/);
});
test('registro duplicado mantiene formulario y muestra error del backend', async () => {
    const state = setup({ ok: false, status: 400, json: async () => ({ mensaje: 'El correo ya está registrado' }) }, 'register');
    await state.submit();
    assert.equal(state.redirect, null);
    assert.match(state.message.textContent, /correo ya está registrado/);
    assert.equal(state.button.disabled, false);
});
