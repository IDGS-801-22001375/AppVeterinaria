const express = require('express');

const {
    obtenerMascotas,
    obtenerMascota,
    crearMascota,
    actualizarMascota,
    eliminarMascota
} = require('../controllers/mascotasController');

const router = express.Router();

router.get('/', obtenerMascotas);
router.get('/:id', obtenerMascota);
router.post('/', require('../middleware/requireSession'), crearMascota);
router.put('/:id', actualizarMascota);
router.delete('/:id', eliminarMascota);

module.exports = router;