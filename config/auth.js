require('dotenv').config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || Buffer.byteLength(jwtSecret, 'utf8') < 32) {
    throw new Error('Configura JWT_SECRET con al menos 32 bytes en .env');
}

module.exports = { jwtSecret };
