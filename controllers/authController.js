const users = require('../repositories/authRepository');
const { jwtSecret } = require('../config/auth');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const clean = (value) => typeof value === 'string' ? value.trim() : '';
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const registrar = async (req, res) => {
    const body = req.body || {};
    const email = clean(body.email).toLowerCase();
    const nombre = clean(body.nombre);
    const apellido = clean(body.apellido);
    const password = body.password;
    if (!validEmail(email) || typeof password !== 'string' || !password.trim() || !nombre || !apellido) {
        return res.status(400).json({ mensaje: 'Email válido, contraseña, nombre y apellido son obligatorios' });
    }
    if (Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({ mensaje: 'La contraseña debe ocupar como máximo 72 bytes' });
    }
    if (email.length > 150 || nombre.length > 80 || apellido.length > 80
        || clean(body.telefono).length > 30 || clean(body.direccion).length > 200) {
        return res.status(400).json({ mensaje: 'Uno de los campos supera la longitud permitida' });
    }
    try {
        if (await users.findByEmail(email)) {
            return res.status(400).json({ mensaje: 'El correo ya está registrado' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        await users.createClient({
            email, passwordHash, nombre, apellido,
            telefono: clean(body.telefono), direccion: clean(body.direccion)
        });
        return res.status(201).json({ mensaje: 'Usuario registrado correctamente' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ mensaje: 'El correo ya está registrado' });
        }
        console.error('Error al registrar usuario:', error.message);
        return res.status(500).json({ mensaje: 'Error al registrar usuario' });
    }
};

const login = async (req, res) => {
    const body = req.body || {};
    const email = clean(body.email).toLowerCase();
    const password = body.password;
    if (!validEmail(email) || typeof password !== 'string' || !password
        || Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({ mensaje: 'Email y contraseña son obligatorios' });
    }
    try {
        const usuario = await users.findByEmail(email);
        if (!usuario || !(await bcrypt.compare(password, usuario.password_hash))) {
            return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos' });
        }
        if (!usuario.activo) {
            return res.status(403).json({ mensaje: 'El usuario está desactivado' });
        }
        const publicUser = { id: usuario.id, email: usuario.email, rol: usuario.rol };
        const token = jwt.sign(publicUser, jwtSecret, { expiresIn: '8h', algorithm: 'HS256' });
        res.set('Cache-Control', 'no-store');
        return res.json({ mensaje: 'Inicio de sesión correcto', token, usuario: publicUser });
    } catch (error) {
        console.error('Error al iniciar sesión:', error.message);
        return res.status(500).json({ mensaje: 'Error al iniciar sesión' });
    }
};

module.exports = { registrar, login };
