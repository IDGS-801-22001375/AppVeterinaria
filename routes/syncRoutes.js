const express = require('express');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { validate } = require('../auth/js/validation');
const requireSession = require('../middleware/requireSession');
const router = express.Router();
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const fieldsPet = ['cliente_id', 'nombre', 'especie', 'raza', 'sexo', 'fecha_nacimiento', 'color', 'observaciones'];
const fieldsUser = ['nombre', 'apellido', 'email', 'telefono', 'direccion'];
function checkBase(row, base, fields) {
    const normal = value => value == null ? '' : String(value);
    if (!base || fields.some(field => normal(row[field]) !== normal(base[field]))) fail('El registro cambió en otro dispositivo. El cambio se conserva: recarga el registro y vuelve a editarlo.', 409);
}
async function resolveId(conn, id, owner, kind = 'pet') {
    if (typeof id === 'string' && id.startsWith('local:')) {
        const [rows] = await conn.execute('SELECT resultado FROM operaciones_offline WHERE propietario_id = ? AND operacion_id = ?', [owner, id.slice(6)]);
        if (!rows.length) fail('Primero sincroniza el registro nuevo.', 409);
        const result = typeof rows[0].resultado === 'string' ? JSON.parse(rows[0].resultado) : rows[0].resultado;
        id = kind === 'user' ? result.cliente_id : result.id;
    }
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) fail('Identificador no válido.');
    return Number(id);
}
async function apply(conn, operation, user, password) {
    const owner = user?.id || 0;
    const body = operation.values || {};
    if (operation.type === 'user:create' || operation.type === 'user:update') {
        const updating = operation.type === 'user:update';
        const { values, errors } = validate({ ...body, password: password || (updating ? 'unchanged-password' : '') }, 'register');
        if (Object.keys(errors).length) fail(Object.values(errors).join('\n'));
        if (updating) {
            if (!user) fail('Inicia sesión para editar.', 401);
            const id = await resolveId(conn, operation.target, owner, 'user');
            const [rows] = await conn.execute('SELECT c.*, u.email FROM clientes c JOIN usuarios u ON u.id = c.usuario_id WHERE c.id = ? FOR UPDATE', [id]);
            if (!rows.length) fail('El usuario ya no existe.', 404);
            if (user.rol !== 'admin' && rows[0].usuario_id !== user.id) fail('Solo puedes editar tu propia cuenta.', 403);
            checkBase(rows[0], operation.base, fieldsUser);
            await conn.execute('UPDATE usuarios SET email = ? WHERE id = ?', [values.email, rows[0].usuario_id]);
            if (password) await conn.execute('UPDATE usuarios SET password_hash = ? WHERE id = ?', [await bcrypt.hash(password, 10), rows[0].usuario_id]);
            await conn.execute('UPDATE clientes SET nombre = ?, apellido = ?, telefono = ?, direccion = ? WHERE id = ?', [values.nombre, values.apellido, values.telefono || null, values.direccion || null, id]);
            return { id: rows[0].usuario_id, cliente_id: id, mensaje: 'Usuario actualizado.' };
        }
        const [result] = await conn.execute("INSERT INTO usuarios (email, password_hash, rol) VALUES (?, ?, 'cliente')", [values.email, await bcrypt.hash(password, 10)]);
        const [client] = await conn.execute('INSERT INTO clientes (usuario_id, nombre, apellido, telefono, direccion) VALUES (?, ?, ?, ?, ?)', [result.insertId, values.nombre, values.apellido, values.telefono || null, values.direccion || null]);
        return { id: result.insertId, cliente_id: client.insertId, mensaje: 'Usuario registrado.' };
    }
    if (!user) fail('Inicia sesión para guardar mascotas.', 401);
    if (!['pet:create', 'pet:update'].includes(operation.type)) fail('Operación no válida.');
    const values = Object.fromEntries(fieldsPet.filter(key => key !== 'cliente_id').map(key => [key, typeof body[key] === 'string' ? body[key].trim() : '']));
    if (!values.nombre || !values.especie) fail('Nombre y especie son obligatorios.');
    for (const [key, limit] of Object.entries({ nombre: 80, especie: 40, raza: 80, color: 50, observaciones: 10000 })) if (values[key].length > limit) fail(`${key}: máximo ${limit} caracteres.`);
    if (values.sexo && !['macho', 'hembra'].includes(values.sexo)) fail('Sexo no válido.');
    if (values.fecha_nacimiento) {
        const date = new Date(values.fecha_nacimiento + 'T00:00:00Z');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(values.fecha_nacimiento) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== values.fecha_nacimiento || date.getTime() > Date.now()) fail('Fecha de nacimiento no válida.');
    }
    const clientId = await resolveId(conn, body.cliente_id, owner, 'user');
    const [clients] = await conn.execute('SELECT usuario_id FROM clientes WHERE id = ?', [clientId]);
    if (!clients.length) fail('El propietario no existe.', 404);
    if (user.rol !== 'admin' && clients[0].usuario_id !== user.id) fail('Solo puedes registrar mascotas en tu perfil.', 403);
    const params = [clientId, values.nombre, values.especie, values.raza || null, values.sexo || null, values.fecha_nacimiento || null, values.color || null, values.observaciones || null];
    if (operation.type === 'pet:create') {
        const [result] = await conn.execute('INSERT INTO mascotas (cliente_id, nombre, especie, raza, sexo, fecha_nacimiento, color, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', params);
        return { id: result.insertId, mensaje: 'Mascota registrada.' };
    }
    const id = await resolveId(conn, operation.target, owner);
    const [rows] = await conn.execute('SELECT m.* FROM mascotas m JOIN clientes c ON c.id = m.cliente_id WHERE m.id = ? AND (? = 1 OR c.usuario_id = ?) FOR UPDATE', [id, user.rol === 'admin' ? 1 : 0, user.id]);
    if (!rows.length) fail('Mascota no disponible para esta cuenta.', 404);
    checkBase(rows[0], operation.base, fieldsPet);
    await conn.execute('UPDATE mascotas SET cliente_id = ?, nombre = ?, especie = ?, raza = ?, sexo = ?, fecha_nacimiento = ?, color = ?, observaciones = ? WHERE id = ?', [...params, id]);
    return { id, mensaje: 'Mascota actualizada.' };
}
router.post('/', (req, res, next) => {
    if (req.get('Authorization')) return requireSession(req, res, next);
    if (req.body?.operation?.type !== 'user:create') return res.status(401).json({ mensaje: 'Inicia sesión para sincronizar.' });
    next();
}, async (req, res) => {
    const { operation, password } = req.body || {};
    if (!operation || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(operation.id || '')) return res.status(400).json({ mensaje: 'Identificador de operación no válido.' });
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();
        const owner = req.usuario?.id || 0;
        const digest = crypto.createHash('sha256').update(JSON.stringify(operation)).digest('hex');
        const [insert] = await conn.execute("INSERT IGNORE INTO operaciones_offline (propietario_id, operacion_id, huella, resultado) VALUES (?, ?, ?, '{}')", [owner, operation.id, digest]);
        if (!insert.affectedRows) {
            const [receipts] = await conn.execute('SELECT huella, resultado FROM operaciones_offline WHERE propietario_id = ? AND operacion_id = ? FOR UPDATE', [owner, operation.id]);
            if (receipts[0].huella !== digest) fail('Identificador ya utilizado por otro cambio.', 409);
            await conn.commit();
            return res.json(typeof receipts[0].resultado === 'string' ? JSON.parse(receipts[0].resultado) : receipts[0].resultado);
        }
        const result = await apply(conn, operation, req.usuario, password);
        await conn.execute('UPDATE operaciones_offline SET resultado = ? WHERE propietario_id = ? AND operacion_id = ?', [JSON.stringify(result), owner, operation.id]);
        await conn.commit();
        res.json(result);
    } catch (error) {
        if (conn) await conn.rollback();
        const status = error.code === 'ER_DUP_ENTRY' ? 409 : error.status || 500;
        res.status(status).json({ mensaje: error.code === 'ER_DUP_ENTRY' ? 'El correo ya está registrado.' : error.code === 'ER_NO_SUCH_TABLE' ? 'Falta ejecutar la migración database/offline.sql para sincronizar.' : status === 500 ? 'No se pudo sincronizar; el cambio se conserva.' : error.message });
    } finally { if (conn) conn.release(); }
});
module.exports = router;
