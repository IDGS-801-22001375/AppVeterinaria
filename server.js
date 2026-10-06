const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        mensaje: 'Servidor levantado correctamente'
    });
});

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
    app.listen(PORT, () => {
        console.log(`Servidor levantado correctamente en http://localhost:${PORT}`);
    });
}

module.exports = app;
