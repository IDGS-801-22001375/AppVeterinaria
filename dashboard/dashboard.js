const API_URL = "http://localhost:3000/api";


async function cargarDashboard() {

    try {

        const respuesta = await fetch(`${API_URL}/dashboard`);

        if (!respuesta.ok) {
            throw new Error("No se pudo obtener la información");
        }

        const datos = await respuesta.json();

        console.log("Datos recibidos:", datos);

        // Totales
        document.getElementById("totalClientes").textContent =
            datos.totalClientes;

        document.getElementById("totalMascotas").textContent =
            datos.totalMascotas;

        document.getElementById("totalUsuarios").textContent =
            datos.totalUsuarios;


        // Mostrar mascotas
        mostrarMascotas(datos.mascotas);

        // Mostrar clientes
        mostrarClientes(datos.clientes);


    } catch (error) {

        console.error("Error:", error);

        document.getElementById("tablaMascotas").innerHTML = `
            <tr>
                <td colspan="6" class="loading">
                    No se pudo conectar con el servidor.
                </td>
            </tr>
        `;

    }

}


/* MASCOTAS */

function mostrarMascotas(mascotas) {

    const tabla = document.getElementById("tablaMascotas");

    tabla.innerHTML = "";

    if (mascotas.length === 0) {

        tabla.innerHTML = `
            <tr>
                <td colspan="6" class="loading">
                    No hay mascotas registradas.
                </td>
            </tr>
        `;

        return;
    }


    mascotas.forEach(mascota => {

        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td>${mascota.nombre}</td>
            <td>${mascota.especie}</td>
            <td>${mascota.raza ?? "Sin especificar"}</td>
            <td>${mascota.sexo ?? "Sin especificar"}</td>
            <td>${mascota.propietario}</td>
            <td>${mascota.telefono ?? "Sin teléfono"}</td>
        `;

        tabla.appendChild(fila);

    });

}


/* CLIENTES */

function mostrarClientes(clientes) {

    const tabla = document.getElementById("tablaClientes");

    tabla.innerHTML = "";

    if (clientes.length === 0) {

        tabla.innerHTML = `
            <tr>
                <td colspan="4" class="loading">
                    No hay clientes registrados.
                </td>
            </tr>
        `;

        return;
    }


    clientes.forEach(cliente => {

        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td>
                ${cliente.nombre} ${cliente.apellido}
            </td>

            <td>
                ${cliente.email}
            </td>

            <td>
                ${cliente.telefono ?? "Sin teléfono"}
            </td>

            <td>
                ${cliente.direccion ?? "Sin dirección"}
            </td>
        `;

        tabla.appendChild(fila);

    });

}


/* CARGAR AL ABRIR LA PÁGINA */

document.addEventListener("DOMContentLoaded", () => {

    cargarDashboard();

});