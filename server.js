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
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard'), { index: 'dashboard.html', setHeaders(res) { res.setHeader('Cache-Control', 'no-store'); } }));
app.use('/sidebar', express.static(path.join(__dirname, 'sidebar')));
app.use('/mascotas', express.static(path.join(__dirname, 'mascotas')));
app.use('/usuarios', express.static(path.join(__dirname, 'usuarios')));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/sync', require('./routes/syncRoutes'));
app.use('/pwa', express.static(path.join(__dirname, 'pwa')));
app.get('/manifest.webmanifest', (req, res) => res.sendFile(path.join(__dirname, 'pwa/manifest.webmanifest')));
app.get('/sw.js', (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, 'pwa/sw.js')); });


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
