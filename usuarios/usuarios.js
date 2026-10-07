(() => {
    const dialog = document.getElementById('user-dialog');
    const form = document.getElementById('user-form');
    const message = document.getElementById('user-message');
    let editing;
    function open(row) {
        editing = row || null; form.reset(); message.textContent = '';
        document.getElementById('user-title').textContent = editing ? 'Editar usuario' : 'Registrar usuario';
        for (const input of form.querySelectorAll('input')) { input.removeAttribute('aria-invalid'); if (editing && input.name !== 'password') input.value = editing[input.name] ?? ''; }
        form.elements.password.required = !editing;
        form.elements.password.placeholder = editing ? 'Vacía para conservar la actual' : 'Mínimo 8 caracteres';
        dialog.showModal();
    }
    document.getElementById('register-user').addEventListener('click', () => open());
    document.addEventListener('user:edit', event => open(event.detail));
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]'); if (button.disabled) return;
        const values = Object.fromEntries(new FormData(form));
        const { errors } = authValidation.validate({ ...values, password: values.password || (editing ? 'unchanged-password' : '') }, 'register');
        for (const input of form.querySelectorAll('input')) { if (errors[input.name]) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
        if (Object.keys(errors).length) { message.textContent = Object.values(errors).join('\n'); form.querySelector('[aria-invalid="true"]')?.focus(); return; }
        button.disabled = true; message.textContent = 'Guardando…';
        try {
            const result = !editing && !navigator.onLine ? await localAuth.register(values) : await offlineApp.mutate(editing ? 'user:update' : 'user:create', values, editing?.id, editing);
            dialog.close();
            document.dispatchEvent(new CustomEvent('dashboard:refresh', { detail: { mensaje: result.mensaje } }));
        } catch (error) { message.textContent = error.message; }
        finally { button.disabled = false; form.elements.password.value = ''; }
    });
})();
