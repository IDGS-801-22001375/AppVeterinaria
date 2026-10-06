const pool = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const registrar = async (req, res) => {
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

        const passwordHash = await bcrypt.hash(password, 10);

        await connection.beginTransaction();

        const [usuarioResult] = await connection.query(
            `INSERT INTO usuarios 
            (email, password_hash, rol)
            VALUES (?, ?, 'cliente')`,
            [email, passwordHash]
        );

        const usuarioId = usuarioResult.insertId;

        await connection.query(
            `INSERT INTO clientes
            (usuario_id, nombre, apellido, telefono, direccion)
            VALUES (?, ?, ?, ?, ?)`,
            [
                usuarioId,
                nombre,
                apellido,
                telefono || null,
                direccion || null
            ]
        );

        await connection.commit();

        res.status(201).json({
            mensaje: 'Usuario registrado correctamente'
        });

    } catch (error) {

    await connection.rollback();

    console.error('ERROR COMPLETO:', error);

    res.status(500).json({
        mensaje: 'Error al registrar usuario',
        error: error.message
    });


    } finally {
        connection.release();
    }
};

const login = async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                mensaje: 'Email y contraseña son obligatorios'
            });
        }

        const [usuarios] = await pool.query(
            `SELECT 
                id,
                email,
                password_hash,
                rol,
                activo
             FROM usuarios
             WHERE email = ?`,
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({
                mensaje: 'Correo o contraseña incorrectos'
            });
        }

        const usuario = usuarios[0];

        if (!usuario.activo) {
            return res.status(403).json({
                mensaje: 'El usuario está desactivado'
            });
        }

        const passwordCorrecta = await bcrypt.compare(
            password,
            usuario.password_hash
        );

        if (!passwordCorrecta) {
            return res.status(401).json({
                mensaje: 'Correo o contraseña incorrectos'
            });
        }

        const token = jwt.sign(
            {
                id: usuario.id,
                email: usuario.email,
                rol: usuario.rol
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '8h'
            }
        );

        res.json({
            mensaje: 'Inicio de sesión correcto',
            token,
            usuario: {
                id: usuario.id,
                email: usuario.email,
                rol: usuario.rol
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: 'Error al iniciar sesión'
        });
    }
};

module.exports = {
    registrar,
    login
};