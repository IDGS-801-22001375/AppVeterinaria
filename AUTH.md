# Login y registro con MySQL

El backend usa únicamente MySQL, mediante `mysql2/promise` en
`config/database.js`. Se conservan clientes, mascotas y las pantallas de
login, registro y sesión. Se eliminó la carpeta `data` y el adaptador JSON.

## Configuración

1. Ejecuta `npm.cmd install`.
2. Copia `.env.example` a `.env` si no existe. Configura:
   - `DB_HOST=localhost`: MySQL instalado en esta computadora.
   - `DB_PORT`: puerto MySQL, normalmente `3306`.
   - `DB_USER=root`: usuario de MySQL.
   - `DB_PASSWORD`: contraseña de ese usuario; vacío solo si la cuenta lo permite.
   - `DB_NAME=veterinaria_huellitas_felices`.
   - `JWT_SECRET`: secreto aleatorio de al menos 32 bytes.
3. Inicia tu servidor MySQL y ejecuta `npm.cmd run db:init`, o ejecuta
   `database/schema.sql` en MySQL Workbench. El script crea la base y las
   tablas si no existen; no borra ni migra datos existentes.
4. Ejecuta `npm.cmd start` y abre http://localhost:3000/auth/register.html.

El `.env` local queda excluido de Git. Para generar un secreto:
`node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.

La conexión configurada usa el servidor local `localhost`, el usuario `root` y
el puerto `3306`. Configura la contraseña de root en `DB_PASSWORD`.

## Autenticación

La conexión a MySQL usa usuario y contraseña. La autenticación integrada
de Windows de SQL Server no se utiliza con este backend MySQL/mysql2.
El login de la aplicación siempre usa correo y contraseña de `usuarios`.

El registro crea `usuarios` y `clientes` en una transacción, guarda el hash
bcrypt y asigna el rol `cliente`. El login devuelve un JWT de 8 horas.
La página de sesión verifica el token y el estado activo desde el backend.
Los usuarios del antiguo JSON no se importan: vuelve a registrarlos.

No ejecutes el INSERT con `HASH_GENERADO`: es un marcador, no un hash válido.
Para un administrador, registra primero la cuenta y cambia su rol desde MySQL:
`UPDATE usuarios SET rol = 'admin' WHERE email = 'admin@ejemplo.com';`

## Rutas y comprobación

- `POST /api/auth/registro`: email, password, nombre, apellido; telefono y direccion opcionales.
- `POST /api/auth/login`: email y password.
- `GET /api/auth/sesion`: cabecera `Authorization: Bearer <token>`.
- `/api/clientes` y `/api/mascotas`: conserva las rutas CRUD del backend existente.

Live Server en el puerto 5500 envía la API al mismo host en el puerto 3000.
Si cambias PORT, abre las pantallas desde Express.

`npm.cmd test` comprueba frontend, API y transacciones con una conexión simulada
solo durante las pruebas. `npm.cmd run test:mysql` comprueba el flujo real en tu
base configurada, crea cuentas con correos únicos y elimina solo esas cuentas
al terminar. Ejecuta `db:init` antes; las credenciales deben estar configuradas.
