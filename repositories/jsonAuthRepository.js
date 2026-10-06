const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const file = path.resolve(process.env.JSON_DB_PATH || path.join(__dirname, '../data/usuarios.json'));
let writes = Promise.resolve();

async function read() {
    const data = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!Array.isArray(data.usuarios) || !Array.isArray(data.clientes)) {
        throw new Error('El JSON debe contener usuarios y clientes');
    }
    return data;
}

const nextId = (rows) => Math.max(0, ...rows.map((row) => row.id)) + 1;

async function findByEmail(email) {
    const data = await read();
    return data.usuarios.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null;
}

async function findById(id) {
    const data = await read();
    return data.usuarios.find((user) => user.id === Number(id)) || null;
}

function createClient(values) {
    // Serializa registros concurrentes dentro de este servidor para no perder datos.
    const operation = writes.then(async () => {
        const data = await read();
        if (data.usuarios.some((user) => user.email.toLowerCase() === values.email.toLowerCase())) {
            const error = new Error('El correo ya está registrado');
            error.code = 'ER_DUP_ENTRY';
            throw error;
        }
        const id = nextId(data.usuarios);
        data.usuarios.push({ id, email: values.email, password_hash: values.passwordHash, rol: 'cliente', activo: 1 });
        data.clientes.push({
            id: nextId(data.clientes), usuario_id: id,
            nombre: values.nombre, apellido: values.apellido,
            telefono: values.telefono || null, direccion: values.direccion || null,
            creado_en: new Date().toISOString()
        });
        // Publica las dos filas juntas; nunca sobrescribe el archivo con JSON incompleto.
        const temporary = `${file}.${randomUUID()}.tmp`;
        try {
            await fs.writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
            await fs.rename(temporary, file);
        } finally {
            await fs.rm(temporary, { force: true });
        }
        return id;
    });
    writes = operation.catch(() => {});
    return operation;
}

module.exports = { findByEmail, findById, createClient };
