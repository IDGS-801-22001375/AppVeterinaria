const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get(['/', '/PaginaPrincipal.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'PaginaPrincipal.html'));
});
app.get('/styles.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'styles.css'));
});
app.use('/img', express.static(path.join(__dirname, 'img')));

app.use('/auth', express.static(path.join(__dirname, 'auth'), {
    setHeaders(res) {
        res.setHeader('Cache-Control', 'no-store');
    }
}));
app.use('/api/auth', authRoutes);


const clientesRoutes = require('./routes/clientesRoutes');

app.use('/api/clientes', clientesRoutes);


const mascotasRoutes = require('./routes/mascotasRoutes');

app.use('/api/mascotas', mascotasRoutes);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
    const pool = require('./config/database');
    pool.query('SELECT id FROM usuarios LIMIT 0')
        .then(() => pool.query('SELECT usuario_id FROM clientes LIMIT 0'))
        .then(() => pool.query('SELECT cliente_id FROM mascotas LIMIT 0'))
        .then(() => app.listen(PORT, () => {
            console.log(`Conectado a MySQL. Inicio: http://localhost:${PORT}/`);
        }))
        .catch(async (error) => {
            console.error(`No se pudo conectar a MySQL (${error.code || 'ERROR'}). Revisa .env y ejecuta database/schema.sql.`);
            await pool.end();
            process.exitCode = 1;
    });
}

module.exports = app;
