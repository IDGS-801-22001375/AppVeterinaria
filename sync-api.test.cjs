const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const express = require('express');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'sync-test-secret-at-least-32-bytes';
let receipts = new Map(), clients = new Map([[10, { id: 10, usuario_id: 1, nombre: 'Ana', apellido: 'Pérez', email: 'ana@example.test', telefono: null, direccion: null }], [11, { id: 11, usuario_id: 2, nombre: 'Otra', apellido: 'Cuenta', email: 'other@example.test', telefono: null, direccion: null }]]), pets = new Map(), users = new Map(), backup;
const conn = {
 async beginTransaction() { backup = structuredClone({ receipts, clients, pets, users }); },
 async commit() { backup = null; },
 async rollback() { if (backup) ({ receipts, clients, pets, users } = backup); backup = null; },
 release() {},
 async execute(sql, params) {
  if (sql.startsWith('INSERT IGNORE INTO operaciones_offline')) {
   const key = params[0] + ':' + params[1];
   if (receipts.has(key)) return [{ affectedRows: 0 }];
   receipts.set(key, { huella: params[2], resultado: '{}' }); return [{ affectedRows: 1 }];
  }
  if (sql.startsWith('SELECT huella, resultado')) return [[receipts.get(params[0] + ':' + params[1])]];
  if (sql.startsWith('UPDATE operaciones_offline')) { receipts.get(params[1] + ':' + params[2]).resultado = params[0]; return [{ affectedRows: 1 }]; }
  if (sql.startsWith('SELECT c.*')) return [[...clients.values()].filter(c => c.id === params[0])];
  if (sql.startsWith('SELECT usuario_id FROM clientes')) return [[...clients.values()].filter(c => c.id === params[0])];
  if (sql.startsWith('INSERT INTO usuarios')) { const id = 100 + users.size; users.set(id, { email: params[0], hash: params[1] }); return [{ insertId: id }]; }
  if (sql.startsWith('INSERT INTO clientes')) { const id = 100 + clients.size; clients.set(id, { id, usuario_id: params[0], nombre: params[1], apellido: params[2], telefono: params[3], direccion: params[4] }); return [{ insertId: id }]; }
  if (sql.startsWith('INSERT INTO mascotas')) { const id = 20 + pets.size; const fields = ['cliente_id', 'nombre', 'especie', 'raza', 'sexo', 'fecha_nacimiento', 'color', 'observaciones']; pets.set(id, { id, ...Object.fromEntries(fields.map((key, i) => [key, params[i]])) }); return [{ insertId: id }]; }
  if (sql.startsWith('SELECT m.*')) return [[...pets.values()].filter(p => p.id === params[0] && (params[1] || clients.get(p.cliente_id).usuario_id === params[2]))];
  if (sql.startsWith('UPDATE mascotas')) { const fields = ['cliente_id', 'nombre', 'especie', 'raza', 'sexo', 'fecha_nacimiento', 'color', 'observaciones']; Object.assign(pets.get(params[8]), Object.fromEntries(fields.map((key, i) => [key, params[i]]))); return [{ affectedRows: 1 }]; }
  if (sql.startsWith('UPDATE usuarios SET email')) return [{ affectedRows: 1 }];
  if (sql.startsWith('UPDATE clientes SET')) { Object.assign(clients.get(params[4]), { nombre: params[0], apellido: params[1], telefono: params[2], direccion: params[3] }); return [{ affectedRows: 1 }]; }
  throw new Error('Consulta no implementada en prueba: ' + sql);
 }
};
require.cache[require.resolve('./config/database')] = { exports: { async getConnection() { return conn; } } };
require.cache[require.resolve('./repositories/authRepository')] = { exports: { async findById(id) { return { id, email: 'ana@example.test', rol: 'cliente', activo: 1 }; } } };
test('sincronización: idempotencia, permisos, edición y conflictos transaccionales', async t => {
 const app = express(); app.use(express.json()); app.use('/api/sync', require('./routes/syncRoutes'));
 const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
 t.after(() => new Promise(resolve => server.close(resolve)));
 const base = `http://127.0.0.1:${server.address().port}/api/sync`;
 const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { algorithm: 'HS256' });
 const send = (operation, password, authenticated = true) => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ operation, password }) });
 const pet = { id: crypto.randomUUID(), type: 'pet:create', values: { cliente_id: 10, nombre: 'Luna', especie: 'perro' } };
 assert.equal((await send(pet, undefined, false)).status, 401);
 const first = await send(pet); assert.equal(first.status, 200); const created = await first.json();
 const repeated = await send(pet); assert.equal(repeated.status, 200); assert.deepEqual(await repeated.json(), created); assert.equal(pets.size, 1);
 assert.equal((await send({ ...pet, values: { ...pet.values, nombre: 'Otra' } })).status, 409);
 const basePet = structuredClone(pets.get(created.id));
 const edit = { id: crypto.randomUUID(), type: 'pet:update', target: created.id, base: basePet, values: { ...basePet, nombre: 'Luna nueva' } };
 assert.equal((await send(edit)).status, 200); assert.equal(pets.get(created.id).nombre, 'Luna nueva');
 const stale = { ...edit, id: crypto.randomUUID(), values: { ...basePet, nombre: 'Cambio obsoleto' } };
 assert.equal((await send(stale)).status, 409); assert.equal(pets.get(created.id).nombre, 'Luna nueva'); assert.equal(receipts.has('1:' + stale.id), false);
 const foreign = { id: crypto.randomUUID(), type: 'user:update', target: 11, base: clients.get(11), values: clients.get(11) };
 assert.equal((await send(foreign)).status, 403);
 const profile = { id: crypto.randomUUID(), type: 'user:update', target: 10, base: structuredClone(clients.get(10)), values: { ...clients.get(10), telefono: '5551234567' } };
 assert.equal((await send(profile)).status, 200); assert.equal(clients.get(10).telefono, '5551234567');
 const user = { id: crypto.randomUUID(), type: 'user:create', values: { email: 'new@example.test', nombre: 'Nueva', apellido: 'Cuenta' } };
 assert.equal((await send(user, 'TestPassword123!', false)).status, 200);
 assert.equal(await bcrypt.compare('TestPassword123!', [...users.values()][0].hash), true);
 assert.equal(JSON.stringify([...receipts.values()]).includes('TestPassword123!'), false);
});
