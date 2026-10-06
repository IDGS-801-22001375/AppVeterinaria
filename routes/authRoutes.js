const express = require('express');
const jwt = require('jsonwebtoken');
const users = require('../repositories/authRepository');
const { jwtSecret } = require('../config/auth');

const {
    registrar,
    login
} = require('../controllers/authController');

const router = express.Router();

router.post('/registro', registrar);
router.post('/login', login);

router.get('/sesion', async (req, res) => {
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
        if (!usuario || !usuario.activo) {
            return res.status(401).json({ mensaje: 'La cuenta no está disponible. Inicia sesión de nuevo.' });
        }
        return res.json({ usuario: { id: usuario.id, email: usuario.email, rol: usuario.rol } });
    } catch (error) {
        console.error('Error al verificar sesión:', error.message);
        return res.status(500).json({ mensaje: 'No se pudo verificar la sesión. Inténtalo de nuevo.' });
    }
});

module.exports = router;
