const { driver } = require('../config/auth');

// Ambos adaptadores ofrecen el mismo contrato a los controladores.
module.exports = driver === 'mysql'
    ? require('./mysqlAuthRepository')
    : require('./jsonAuthRepository');
