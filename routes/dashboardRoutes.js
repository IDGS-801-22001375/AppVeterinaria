const express = require('express');
const pool = require('../config/database');
const requireSession = require('../middleware/requireSession');
const router = express.Router();

router.get('/', requireSession, async (req, res) => {
    try {
        const admin = req.usuario.rol === 'admin';
        const filter = admin ? '' : 'WHERE c.usuario_id = ?';
        const params = admin ? [] : [req.usuario.id];
        const [clientes] = await pool.execute(`
            SELECT c.id, c.usuario_id, c.nombre, c.apellido, c.telefono, c.direccion, u.email
            FROM clientes c JOIN usuarios u ON u.id = c.usuario_id
            ${filter} ORDER BY c.id DESC`, params);
        const [mascotas] = await pool.execute(`
            SELECT m.id, m.cliente_id, m.nombre, m.especie, m.raza, m.sexo, m.fecha_nacimiento, m.color, m.observaciones,
                CONCAT(c.nombre, ' ', c.apellido) AS propietario, c.telefono
            FROM mascotas m JOIN clientes c ON c.id = m.cliente_id
            ${filter} ORDER BY m.id DESC`, params);
        let totalUsuarios = 1;
        if (admin) {
            const [counts] = await pool.execute('SELECT COUNT(*) AS total FROM usuarios');
            totalUsuarios = counts[0].total;
        }
        res.json({ totalClientes: clientes.length, totalMascotas: mascotas.length, totalUsuarios, clientes, mascotas });
    } catch (error) {
        console.error('Error al cargar dashboard:', error.message);
        res.status(500).json({ mensaje: 'No se pudo cargar el dashboard. Inténtalo de nuevo.' });
    }
});
module.exports = router;
