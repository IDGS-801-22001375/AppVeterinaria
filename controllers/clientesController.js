const pool = require('../config/database');

const obtenerClientes = async (req, res) => {

    try {

        const [clientes] = await pool.query(`
            SELECT 
                c.id,
                c.usuario_id,
                u.email,
                u.rol,
                c.nombre,
                c.apellido,
                c.telefono,
                c.direccion,
                c.creado_en
            FROM clientes c
            INNER JOIN usuarios u 
                ON c.usuario_id = u.id
            ORDER BY c.id DESC
        `);

        res.json(clientes);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: 'Error al obtener clientes'
        });
    }
};

const obtenerCliente = async (req, res) => {

    try {

        const { id } = req.params;

        const [clientes] = await pool.query(`
            SELECT 
                c.id,
                c.usuario_id,
                u.email,
                u.rol,
                c.nombre,
                c.apellido,
                c.telefono,
                c.direccion,
                c.creado_en
            FROM clientes c
            INNER JOIN usuarios u 
                ON c.usuario_id = u.id
            WHERE c.id = ?
        `, [id]);

        if (clientes.length === 0) {
            return res.status(404).json({
                mensaje: 'Cliente no encontrado'
            });
        }

        res.json(clientes[0]);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: 'Error al obtener cliente'
        });
    }
};

const crearCliente = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        const {
            email,
            password,
            nombre,
            apellido,
            telefono,
            direccion
        } = req.body;

        if (!email || !password || !nombre || !apellido) {
            return res.status(400).json({
                mensaje: 'Email, contraseña, nombre y apellido son obligatorios'
            });
        }

        const [usuarioExistente] = await connection.query(
            'SELECT id FROM usuarios WHERE email = ?',
            [email]
        );

        if (usuarioExistente.length > 0) {
            return res.status(400).json({
                mensaje: 'El correo ya está registrado'
            });
        }

        const bcrypt = require('bcrypt');

        const passwordHash = await bcrypt.hash(password, 10);

        await connection.beginTransaction();

        const [usuario] = await connection.query(
            `INSERT INTO usuarios
            (email, password_hash, rol)
            VALUES (?, ?, 'cliente')`,
            [email, passwordHash]
        );

        await connection.query(
            `INSERT INTO clientes
            (usuario_id, nombre, apellido, telefono, direccion)
            VALUES (?, ?, ?, ?, ?)`,
            [
                usuario.insertId,
                nombre,
                apellido,
                telefono || null,
                direccion || null
            ]
        );

        await connection.commit();

        res.status(201).json({
            mensaje: 'Cliente creado correctamente'
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({
            mensaje: 'Error al crear cliente'
        });

    } finally {

        connection.release();
    }
};

const actualizarCliente = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            nombre,
            apellido,
            telefono,
            direccion
        } = req.body;

        const [resultado] = await pool.query(
            `UPDATE clientes
             SET nombre = ?,
                 apellido = ?,
                 telefono = ?,
                 direccion = ?
             WHERE id = ?`,
            [
                nombre,
                apellido,
                telefono || null,
                direccion || null,
                id
            ]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Cliente no encontrado'
            });
        }

        res.json({
            mensaje: 'Cliente actualizado correctamente'
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: 'Error al actualizar cliente'
        });
    }
};

const eliminarCliente = async (req, res) => {

    try {

        const { id } = req.params;

        const [cliente] = await pool.query(
            'SELECT usuario_id FROM clientes WHERE id = ?',
            [id]
        );

        if (cliente.length === 0) {
            return res.status(404).json({
                mensaje: 'Cliente no encontrado'
            });
        }

        await pool.query(
            'DELETE FROM usuarios WHERE id = ?',
            [cliente[0].usuario_id]
        );

        res.json({
            mensaje: 'Cliente eliminado correctamente'
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: 'Error al eliminar cliente'
        });
    }
};

module.exports = {
    obtenerClientes,
    obtenerCliente,
    crearCliente,
    actualizarCliente,
    eliminarCliente
};