# Autenticación con JSON o MySQL

Ejecuta `npm.cmd install` y `npm.cmd start`. Abre
http://localhost:3000/auth/login.html (o el puerto de PORT).
También puedes abrir el frontend con Live Server en localhost:5500 o
127.0.0.1:5500: auth.js envía la API al mismo host en el puerto 3000.
Debes mantener Node activo con `npm.cmd start`. Si configuras otro PORT,
abre directamente el frontend desde ese puerto de Node. No uses file://.

Sin configuración, el login y el registro usan `data/usuarios.json`.
Cuenta de ejemplo: `demo@veterinaria.test`, contraseña `Demo1234!`.
El registro guarda la cuenta y su perfil juntos en el archivo; después redirige
al login. Al iniciar sesión se muestra una página con el título
“Inicio de sesión exitoso”, tras verificar el JWT en el backend.

## Datos

- `usuarios`: id, email, password_hash (bcrypt), rol, activo.
- `clientes`: id, usuario_id, nombre, apellido, telefono, direccion, creado_en.

`clientes.usuario_id` referencia `usuarios.id`, igual que las consultas existentes.
No se guarda la contraseña original. El archivo queda fuera del directorio público.
Los registros persisten al reiniciar. Sin JWT_SECRET, las sesiones de la simulación
dejan de ser válidas al reiniciar el servidor.

## Cambiar a MySQL

Copia `.env.example` a `.env` si todavía no tienes uno. Configura `DB_DRIVER=mysql`,
las variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` y un
`JWT_SECRET` largo y aleatorio. Reinicia el servidor. No cambies HTML, JavaScript,
rutas ni controladores: `repositories/authRepository.js` elige el adaptador.
La conexión real sigue en `config/database.js`.

La base debe tener las tablas que ya usa el backend: IDs autoincrementales,
email único en usuarios, activo con valor inicial 1, password_hash de longitud
suficiente para bcrypt y la relación clientes.usuario_id → usuarios.id.
creado_en debe tener su valor por defecto en clientes.
El JSON no se importa automáticamente a MySQL; sus cuentas son datos de prueba.

El adaptador JSON cubre autenticación (registro, login y consulta de sesión).
Las rutas CRUD de clientes y mascotas conservan su conexión MySQL original.
La simulación admite un solo proceso del servidor; sus escrituras se serializan
y se publican por reemplazo del archivo. No es una base para producción.

Ejecuta `npm.cmd test` para probar frontend y API con un JSON temporal aislado.
