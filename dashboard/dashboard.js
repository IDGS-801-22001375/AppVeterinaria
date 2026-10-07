const TOKEN_KEY = 'veterinaria.token';
const isLiveServer = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && location.port === '5500';
const API_URL = (isLiveServer ? `${location.protocol}//${location.hostname}:3000` : '') + '/api';
const statusMessage = document.getElementById('dashboard-message');
const refreshButton = document.getElementById('refresh-dashboard');
let loading = false;

function cerrarSesion() {
    sessionStorage.removeItem(TOKEN_KEY);
    location.replace('/auth/login.html');
}

async function solicitar(route, token) {
    try { return await offlineApp.get('/api' + route); }
    catch (error) { if (error.status === 401 || error.status === 403) cerrarSesion(); throw error; }
}
function editButton(type, row) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'btn-refresh';
    button.textContent = row.pending ? 'Editar (pendiente)' : 'Editar';
    button.addEventListener('click', () => document.dispatchEvent(new CustomEvent(type + ':edit', { detail: structuredClone(row) })));
    return button;
}
function mostrarTabla(id, filas, columnas, mensajeVacio) {
    const tabla = document.getElementById(id);
    tabla.replaceChildren();
    if (!filas.length) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');
        celda.colSpan = columnas.length;
        celda.className = 'loading';
        celda.textContent = mensajeVacio;
        fila.appendChild(celda);
        tabla.appendChild(fila);
        return;
    }
    for (const datos of filas) {
        const fila = document.createElement('tr');
        for (const valor of columnas) {
            const celda = document.createElement('td');
            const content = valor(datos);
            if (content instanceof Node) celda.appendChild(content); else celda.textContent = content;
            fila.appendChild(celda);
        }
        tabla.appendChild(fila);
    }
}

async function cargarDashboard() {
    if (loading) return;
    loading = true;
    refreshButton.disabled = true;
    statusMessage.textContent = 'Verificando sesión y cargando información…';
    statusMessage.hidden = false;
    try {
        const token = sessionStorage.getItem(TOKEN_KEY);
        if (!token) { location.replace('/auth/login.html'); return; }
        const session = await solicitar('/auth/sesion', token);
        document.getElementById('session-user').textContent = `${session.usuario.email} · ${session.usuario.rol === 'admin' ? 'Administrador' : 'Cliente'}`;
        const datos = await solicitar('/dashboard', token);
        for (const id of ['totalClientes', 'totalMascotas', 'totalUsuarios']) document.getElementById(id).textContent = datos[id];
        mostrarTabla('tablaMascotas', datos.mascotas, [m => m.nombre, m => m.especie, m => m.raza ?? 'Sin especificar', m => m.sexo ?? 'Sin especificar', m => m.propietario, m => m.telefono ?? 'Sin teléfono', m => editButton('pet', m)], 'No hay mascotas registradas.');
        mostrarTabla('tablaClientes', datos.clientes, [c => `${c.nombre} ${c.apellido}`, c => c.email, c => c.telefono ?? 'Sin teléfono', c => c.direccion ?? 'Sin dirección', c => editButton('user', c)], 'No hay clientes registrados.');
        statusMessage.hidden = true;
    } catch (error) {
        statusMessage.textContent = error.name === 'TimeoutError' ? 'El servidor tardó demasiado. Pulsa Actualizar para intentar de nuevo.' : error instanceof TypeError ? 'No se pudo conectar con el servidor. Pulsa Actualizar para intentar de nuevo.' : error.message;
        mostrarTabla('tablaMascotas', [], Array(7).fill(() => ''), 'No se pudo cargar la información.');
        mostrarTabla('tablaClientes', [], Array(5).fill(() => ''), 'No se pudo cargar la información.');
        for (const id of ['totalClientes', 'totalMascotas', 'totalUsuarios']) document.getElementById(id).textContent = '—';
    } finally {
        loading = false;
        refreshButton.disabled = false;
    }
}
refreshButton.addEventListener('click', cargarDashboard);
document.getElementById('logout').addEventListener('click', cerrarSesion);
window.addEventListener('pageshow', cargarDashboard);

document.addEventListener('dashboard:refresh', async event => {
    const result = document.getElementById('registration-result');
    result.textContent = event.detail.mensaje;
    result.hidden = false;
    await cargarDashboard();
});

document.addEventListener('offline:changed', () => { if (!loading) cargarDashboard(); });
