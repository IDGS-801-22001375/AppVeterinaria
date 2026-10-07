require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        charset: 'utf8mb4',
        // Solo para ejecutar nuestro archivo SQL, nunca entradas de la API.
        multipleStatements: true
    });
    try {
        const schema = await fs.readFile(path.join(__dirname, '../database/schema.sql'), 'utf8');
        await connection.query(schema);
        console.log('Base veterinaria_huellitas_felices y tablas preparadas.');
    } finally {
        await connection.end();
    }
}

main().catch((error) => {
    console.error(`No se pudo preparar MySQL (${error.code || 'ERROR'}). Revisa DB_HOST, DB_PORT, DB_USER y DB_PASSWORD en .env.`);
    process.exitCode = 1;
});
