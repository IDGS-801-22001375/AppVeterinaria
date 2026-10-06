const { randomBytes } = require('node:crypto');
require('dotenv').config();

const driver = process.env.DB_DRIVER || 'json';
if (!['json', 'mysql'].includes(driver)) throw new Error('DB_DRIVER debe ser json o mysql');
if (driver === 'mysql' && !process.env.JWT_SECRET) {
    throw new Error('Configura JWT_SECRET para usar MySQL');
}

module.exports = {
    driver,
    // En la simulación, las sesiones vencen al reiniciar si no se configura JWT_SECRET.
    jwtSecret: process.env.JWT_SECRET || randomBytes(32).toString('hex')
};
