const express = require('express');
const cors = require('cors');
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

app.use((req, res, next) => {
    console.log('BODY RECIBIDO:', req.body);
    next();
});
app.use('/api/auth', authRoutes);


const clientesRoutes = require('./routes/clientesRoutes');

app.use('/api/clientes', clientesRoutes);


const mascotasRoutes = require('./routes/mascotasRoutes');

app.use('/api/mascotas', mascotasRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor levantado correctamente en http://localhost:${PORT}`);
});