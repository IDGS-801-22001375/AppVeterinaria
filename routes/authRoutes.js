const express = require('express');
const { registrar, login } = require('../controllers/authController');
const requireSession = require('../middleware/requireSession');
const router = express.Router();
router.post('/registro', registrar);
router.post('/login', login);
router.get('/sesion', requireSession, (req, res) => res.json({ usuario: req.usuario }));
module.exports = router;
