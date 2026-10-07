(() => {
    const dialog = document.getElementById('pet-dialog');
    const form = document.getElementById('pet-form');
    const message = document.getElementById('pet-message');
    const owners = form.elements.cliente_id;
    let editing;
    async function open(row) {
        editing = row || null;
        form.reset(); owners.replaceChildren();
        document.getElementById('pet-title').textContent = editing ? 'Editar mascota' : 'Registrar mascota';
        message.textContent = 'Cargando propietarios…'; dialog.showModal();
        const button = form.querySelector('button[type="submit"]'); button.disabled = true;
        try {
            const data = await offlineApp.get('/api/dashboard');
            for (const client of data.clientes) owners.add(new Option(`${client.nombre} ${client.apellido}`, client.id));
            if (!data.clientes.length) throw new Error('Necesitas un perfil de cliente para registrar una mascota.');
            if (editing) for (const field of Array.from(form.elements)) if (field.name) field.value = editing[field.name] ?? '';
            message.textContent = ''; button.disabled = false;
        } catch (error) { message.textContent = error.message; }
    }
    document.getElementById('register-pet').addEventListener('click', () => open());
    document.addEventListener('pet:edit', event => open(event.detail));
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]'); if (button.disabled) return;
        const values = Object.fromEntries(new FormData(form));
        for (const key of Object.keys(values)) values[key] = values[key].trim();
        if (!form.reportValidity() || !values.nombre || !values.especie) { message.textContent = 'Propietario, nombre y especie son obligatorios.'; return; }
        if (values.fecha_nacimiento && (!/^\d{4}-\d{2}-\d{2}$/.test(values.fecha_nacimiento) || new Date(values.fecha_nacimiento + 'T00:00:00Z').getTime() > Date.now())) { message.textContent = 'Fecha de nacimiento no válida.'; return; }
        button.disabled = true; message.textContent = 'Guardando…';
        try {
            const result = await offlineApp.mutate(editing ? 'pet:update' : 'pet:create', values, editing?.id, editing);
            dialog.close();
            document.dispatchEvent(new CustomEvent('dashboard:refresh', { detail: { mensaje: result.mensaje } }));
        } catch (error) { message.textContent = error.message; }
        finally { button.disabled = false; }
    });
})();
