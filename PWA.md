# PWA y autenticación sin conexión

## Registro e inicio local

El registro sin conexión crea una cuenta de cliente en este navegador y lleva
al login. Puedes entrar inmediatamente con su correo y contraseña, cerrar
sesión y volver a entrar incluso después de cerrar y abrir la PWA.

Las cuentas usadas con conexión preparan su acceso local después de que el
servidor acepta el login y se descarga el dashboard. Una cuenta que nunca se
registró o verificó en este dispositivo no puede aparecer automáticamente
sin conexión: regístrala localmente o entra una vez con conexión.

`pwa/local-auth.js` utiliza Web Crypto PBKDF2-SHA256, una sal aleatoria por cuenta
y un verificador de 256 bits. IndexedDB almacena ese verificador, la sal, el correo
y los datos del perfil. No guarda la contraseña en texto ni un cifrado recuperable.

Las sesiones locales se distinguen de los JWT reales. No autorizan solicitudes
al backend, roles administrativos ni acceso a datos de otra cuenta del servidor.
Un rechazo 401 del servidor no se convierte automáticamente en un login local
para una cuenta ya confirmada.

## Datos y reconexión

Con tu sesión local puedes consultar el dashboard, registrar mascotas y editar
perfiles y mascotas. Los cambios quedan pendientes en este dispositivo.

Al volver internet, abre el panel inferior e introduce la contraseña en
Validar cuenta. La cuenta se registra, si es nueva, y se confirma con un login
real del servidor. Sus registros pendientes se reasignan al perfil real.
También puedes iniciar sesión normalmente con conexión para confirmar la cuenta.
La contraseña se usa en memoria durante la petición y luego se descarta.

Si el correo ya existe en el servidor con otra contraseña, se muestra el
conflicto y se conservan tu cuenta y datos locales. No se cambia ni se sobrescribe
la cuenta remota. Los correos duplicados se rechazan en este navegador al registrar.

El registro desde el dashboard también permite crear una cuenta local sin
conexión; esa cuenta dispone de sus propios datos y puede entrar desde el login.
Los registros de otros clientes no se muestran en una sesión de cliente.

## Instalación y actualización

Abre la app desde Express en http://localhost:3000/, con conexión una vez, para
descargar sus pantallas y recursos. Instala desde Instalar app o el menú del
navegador. Para otros hosts usa HTTPS; localhost permite Web Crypto y service
workers. Live Server no es el origen recomendado para instalar la PWA.

Después de actualizar el código, reinicia Node y recarga con conexión para
actualizar el service worker. Un navegador que nunca descargó el sitio no puede
abrirlo sin internet. Borrar los datos del sitio elimina las cuentas locales y
los cambios pendientes. No se promete sincronización con la ventana cerrada.

## Migración de la cola de edición

`database/offline.sql` crea únicamente `operaciones_offline` para evitar duplicados
al sincronizar mascotas o cambios de perfiles. Su ejecución sigue pendiente de
aprobación específica si todavía no se realizó. Registrar e iniciar sesión
localmente no requiere esa tabla. Confirmar una cuenta usa las rutas originales
de registro y login; sincronizar mascotas y perfiles sí necesita la tabla auxiliar.

## Pruebas

`npm.cmd test`: validación, autenticación, cola, permisos, conflictos, credenciales
locales y aislamiento de cuentas con bases simuladas.

`npm.cmd run test:pwa`: Edge/Chromium, registro y login offline, password incorrecto,
cierre y reapertura, navegación, edición, reconexión y ausencia de contraseñas en
el almacenamiento. Las respuestas del backend se simulan y no alteran MySQL.

Referencia de Web Crypto: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits
