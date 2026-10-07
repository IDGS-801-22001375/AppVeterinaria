const jwt = require('jsonwebtoken');
const users = require('../repositories/authRepository');
const { jwtSecret } = require('../config/auth');

module.exports = async function requireSession(req, res, next) {
    res.set('Cache-Control', 'no-store');
    const authorization = req.get('Authorization') || '';
    let payload;
    try {
        if (!authorization.startsWith('Bearer ')) throw new Error('Token requerido');
        payload = jwt.verify(authorization.slice(7), jwtSecret, { algorithms: ['HS256'] });
    } catch {
        return res.status(401).json({ mensaje: 'Tu sesión venció o no es válida. Inicia sesión de nuevo.' });
    }
    try {
        const usuario = await users.findById(payload.id);
        if (!usuario || !usuario.activo) return res.status(401).json({ mensaje: 'La cuenta no está disponible. Inicia sesión de nuevo.' });
        req.usuario = { id: usuario.id, email: usuario.email, rol: usuario.rol };
        next();
    } catch (error) {
        console.error('Error al verificar sesión:', error.message);
        res.status(500).json({ mensaje: 'No se pudo verificar la sesión. Inténtalo de nuevo.' });
    }
};
