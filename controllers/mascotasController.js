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

    try {

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

        const [cliente] = await pool.query(
            'SELECT id FROM clientes WHERE id = ?',
            [cliente_id]
        );

        if (cliente.length === 0) {
            return res.status(404).json({
                mensaje: 'El cliente no existe'
            });
        }

        const [resultado] = await pool.query(
            `INSERT INTO mascotas
            (
                cliente_id,
                nombre,
                especie,
                raza,
                sexo,
                fecha_nacimiento,
                color,
                observaciones
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                cliente_id,
                nombre,
                especie,
                raza || null,
                sexo || null,
                fecha_nacimiento || null,
                color || null,
                observaciones || null
            ]
        );

        res.status(201).json({
            mensaje: 'Mascota creada correctamente',
            id: resultado.insertId
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: 'Error al crear mascota'
        });
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