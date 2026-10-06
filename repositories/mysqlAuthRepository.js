const pool = require('../config/database');

async function findByEmail(email) {
    const [rows] = await pool.query(
        'SELECT id, email, password_hash, rol, activo FROM usuarios WHERE email = ?', [email]
    );
    return rows[0] || null;
}

async function findById(id) {
    const [rows] = await pool.query('SELECT id, email, rol, activo FROM usuarios WHERE id = ?', [id]);
    return rows[0] || null;
}

async function createClient(values) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [user] = await connection.query(
            "INSERT INTO usuarios (email, password_hash, rol) VALUES (?, ?, 'cliente')",
            [values.email, values.passwordHash]
        );
        await connection.query(
            'INSERT INTO clientes (usuario_id, nombre, apellido, telefono, direccion) VALUES (?, ?, ?, ?, ?)',
            [user.insertId, values.nombre, values.apellido, values.telefono || null, values.direccion || null]
        );
        await connection.commit();
        return user.insertId;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { findByEmail, findById, createClient };
