# Cambio propuesto: registro y login sin internet

Estado: autorizado por el usuario e implementado. Ver PWA.md y pwa/local-auth.js.

## Comportamiento

- Registrar sin internet crea una cuenta de cliente en este navegador y permite
  iniciar sesión inmediatamente con su correo y contraseña.
- Las cuentas usadas online pueden preparar su acceso local tras una respuesta
  correcta del servidor; nunca se crea un acceso local por un login rechazado.
- Iniciar sesión offline verifica la contraseña contra un verificador local.
- La sesión local abre el dashboard y permite conservar mascotas y perfiles
  pendientes. No se presenta al backend como un JWT válido.
- Cerrar sesión exige ingresar de nuevo la contraseña para acceder localmente.
- Al volver internet se confirma el registro y se obtiene una sesión real del
  servidor. Si el correo existe con otra contraseña, se conserva la cuenta local
  y se muestra el conflicto; no se sobreescribe la cuenta remota.

## Datos que se autoriza guardar en el navegador

IndexedDB: correo, perfil, identificador local, sal aleatoria y verificador
PBKDF2-SHA256 de la contraseña. Nunca la contraseña en texto ni un cifrado que
permita recuperarla. La sal y el número de iteraciones se guardan junto al hash.
Las contraseñas introducidas para sincronizar solo permanecen temporalmente en
memoria durante la sesión y se envían al backend al recuperar la conexión.

SessionStorage: identificador de la sesión local, separado del token real del
servidor. Los datos locales permanecen en el dispositivo hasta borrarlos desde
el navegador; borrar almacenamiento elimina cuentas y cambios no sincronizados.

## Alcance y límites

- Implementación en un módulo propio pwa/local-auth.js.
- Integración con login, registro, dashboard y cola existente.
- Pruebas en navegador: registro, login correcto e incorrecto, logout, recarga,
  aislamiento entre cuentas, reconexión y conflictos.
- No cambia la autenticación del servidor ni roles o contraseñas existentes.
- No ejecuta migraciones ni modifica la base para habilitar login local.
- La PWA debe haberse descargado al menos una vez con conexión: un navegador
  que nunca descargó el sitio no puede abrirlo sin internet.

Referencia de Web Crypto para derivar el verificador:
https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits
