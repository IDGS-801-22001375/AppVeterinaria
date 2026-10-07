const pool = require('../config/database');

const obtenerMascotas = async (req, res) => {

    try {

        const [mascotas] = await pool.query(`
            SELECT 
                m.id,
                m.cliente_id,
                CONCAT(c.nombre, ' ', c.apellido) AS dueño,
                m.nombre,
                m.especie,
                m.raza,
                m.sexo,
                m.fecha_nacimiento,
                m.color,
                m.observaciones,
                m.creado_en
            FROM mascotas m
            INNER JOIN clientes c
                ON m.cliente_id = c.id
            ORDER BY m.id DESC
        `);

        res.json(mascotas);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: 'Error al obtener mascotas'
        });
    }
};

const obtenerMascota = async (req, res) => {

    try {

        const { id } = req.params;

        const [mascotas] = await pool.query(`
            SELECT 
                m.id,
                m.cliente_id,
                CONCAT(c.nombre, ' ', c.apellido) AS dueño,
                m.nombre,
                m.especie,
                m.raza,
                m.sexo,
                m.fecha_nacimiento,
                m.color,
                m.observaciones,
                m.creado_en
            FROM mascotas m
            INNER JOIN clientes c
                ON m.cliente_id = c.id
            WHERE m.id = ?
        `, [id]);

        if (mascotas.length === 0) {
            return res.status(404).json({
                mensaje: 'Mascota no encontrada'
            });
        }

        res.json(mascotas[0]);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: 'Error al obtener mascota'
        });
    }
};

const crearMascota = async (req, res) => {
    const body = req.body || {};
    const clean = value => typeof value === 'string' ? value.trim() : '';
    const values = {};
    for (const key of ['nombre', 'especie', 'raza', 'sexo', 'fecha_nacimiento', 'color', 'observaciones']) values[key] = clean(body[key]);
    const clienteId = Number(body.cliente_id);
    if (!Number.isSafeInteger(clienteId) || clienteId <= 0 || !values.nombre || !values.especie) return res.status(400).json({ mensaje: 'Propietario, nombre y especie son obligatorios.' });
    for (const [key, max] of Object.entries({ nombre: 80, especie: 40, raza: 80, color: 50, observaciones: 10000 })) {
        if (values[key].length > max) return res.status(400).json({ mensaje: `${key}: máximo ${max} caracteres.` });
    }
    if (values.sexo && !['macho', 'hembra'].includes(values.sexo)) return res.status(400).json({ mensaje: 'Selecciona macho, hembra o sin especificar.' });
    if (values.fecha_nacimiento) {
        const date = new Date(values.fecha_nacimiento + 'T00:00:00Z');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(values.fecha_nacimiento) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== values.fecha_nacimiento || date.getTime() > Date.now()) return res.status(400).json({ mensaje: 'Escribe una fecha de nacimiento válida que no esté en el futuro.' });
    }
    try {
        const [clientes] = await pool.execute('SELECT id, usuario_id FROM clientes WHERE id = ?', [clienteId]);
        if (!clientes.length) return res.status(404).json({ mensaje: 'El propietario no existe.' });
        if (req.usuario.rol !== 'admin' && clientes[0].usuario_id !== req.usuario.id) return res.status(403).json({ mensaje: 'Solo puedes registrar mascotas en tu propio perfil.' });
        const [result] = await pool.execute(`INSERT INTO mascotas
            (cliente_id, nombre, especie, raza, sexo, fecha_nacimiento, color, observaciones)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [clienteId, values.nombre, values.especie, values.raza || null, values.sexo || null, values.fecha_nacimiento || null, values.color || null, values.observaciones || null]);
        res.status(201).json({ mensaje: 'Mascota registrada correctamente.', id: result.insertId });
    } catch (error) {
        console.error('Error al registrar mascota:', error.message);
        res.status(500).json({ mensaje: 'No se pudo registrar la mascota. Inténtalo de nuevo.' });
    }
};
const actualizarMascota = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            cliente_id,
            nombre,
            especie,
            raza,
            sexo,
            fecha_nacimiento,
            color,
            observaciones
        } = req.body;

        if (!cliente_id || !nombre || !especie) {
            return res.status(400).json({
                mensaje: 'Cliente, nombre y especie son obligatorios'
            });
        }

        const [resultado] = await pool.query(
            `UPDATE mascotas
             SET cliente_id = ?,
                 nombre = ?,
                 especie = ?,
                 raza = ?,
                 sexo = ?,
                 fecha_nacimiento = ?,
                 color = ?,
                 observaciones = ?
             WHERE id = ?`,
            [
                cliente_id,
                nombre,
                especie,
                raza || null,
                sexo || null,
                fecha_nacimiento || null,
                color || null,
                observaciones || null,
                id
            ]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Mascota no encontrada'
            });
        }

        res.json({
            mensaje: 'Mascota actualizada correctamente'
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: 'Error al actualizar mascota'
        });
    }
};

const eliminarMascota = async (req, res) => {

    try {

        const { id } = req.params;

        const [resultado] = await pool.query(
            'DELETE FROM mascotas WHERE id = ?',
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Mascota no encontrada'
            });
        }

        res.json({
            mensaje: 'Mascota eliminada correctamente'
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: 'Error al eliminar mascota'
        });
    }
};

module.exports = {
    obtenerMascotas,
    obtenerMascota,
    crearMascota,
    actualizarMascota,
    eliminarMascota
};