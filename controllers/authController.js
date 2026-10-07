const users = require('../repositories/authRepository');
const { jwtSecret } = require('../config/auth');
const { validate } = require('../auth/js/validation');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const registrar = async (req, res) => {
    const { values, errors } = validate(req.body, 'register');
    if (Object.keys(errors).length) return res.status(400).json({ mensaje: Object.values(errors).join('\n'), errores: errors });
    try {
        if (await users.findByEmail(values.email)) return res.status(400).json({ mensaje: 'El correo ya está registrado. Inicia sesión o usa otro correo.', errores: { email: 'Este correo ya tiene una cuenta.' } });
        const passwordHash = await bcrypt.hash(values.password, 10);
        await users.createClient({ ...values, passwordHash });
        return res.status(201).json({ mensaje: 'Usuario registrado correctamente' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ mensaje: 'El correo ya está registrado. Inicia sesión o usa otro correo.' });
        console.error('Error al registrar usuario:', error.message);
        return res.status(500).json({ mensaje: 'No se pudo registrar tu cuenta. Inténtalo de nuevo.' });
    }
};

const login = async (req, res) => {
    const { values, errors } = validate(req.body, 'login');
    if (Object.keys(errors).length) return res.status(400).json({ mensaje: Object.values(errors).join('\n'), errores: errors });
    try {
        const usuario = await users.findByEmail(values.email);
        if (!usuario || !(await bcrypt.compare(values.password, usuario.password_hash))) return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos' });
        if (!usuario.activo) return res.status(403).json({ mensaje: 'El usuario está desactivado' });
        const publicUser = { id: usuario.id, email: usuario.email, rol: usuario.rol };
        const token = jwt.sign(publicUser, jwtSecret, { expiresIn: '8h', algorithm: 'HS256' });
        res.set('Cache-Control', 'no-store');
        return res.json({ mensaje: 'Inicio de sesión correcto', token, usuario: publicUser });
    } catch (error) {
        console.error('Error al iniciar sesión:', error.message);
        return res.status(500).json({ mensaje: 'No se pudo iniciar sesión. Inténtalo de nuevo.' });
    }
};

module.exports = { registrar, login };
