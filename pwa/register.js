(() => {
    if ('serviceWorker' in navigator && location.port !== '5500') navigator.serviceWorker.register('/sw.js').catch(console.error);
    const panel = document.createElement('section');
    panel.className = 'offline-panel';
    panel.hidden = true;
    panel.innerHTML = '<div id="validate-local" hidden><input type="password" id="local-password" autocomplete="current-password" placeholder="Contraseña de tu cuenta local" aria-label="Contraseña para validar cuenta local"><button type="button" id="confirm-account">Validar cuenta</button></div><div id="pending-list"></div><p id="sync-error" role="status"></p>';
    document.body.appendChild(panel);
    const list = panel.querySelector('#pending-list');
    const error = panel.querySelector('#sync-error');
    document.addEventListener('offline:message', event => { error.textContent = event.detail; panel.hidden = !event.detail; });
    async function refresh() {
        try {
            const items = await offlineApp.pending();
            const localSession = sessionStorage.getItem('veterinaria.token')?.startsWith('local:');
            panel.querySelector('#validate-local').hidden = !localSession;
            if (localSession) { const account = await offlineApp.read('auth:' + sessionStorage.getItem('veterinaria.local-email')); if (account?.syncError) error.textContent = account.syncError; }
            const actionable = items.filter(item => item.error || (item.needsPassword && !item.registration));
            panel.hidden = !(localSession && navigator.onLine) && !actionable.length && !error.textContent;
            panel.querySelector('#validate-local').hidden = !(localSession && navigator.onLine);
            list.replaceChildren();
            for (const item of actionable) {
                const row = document.createElement('div');
                const text = document.createElement('span');
                text.textContent = `${item.operation.type} · ${item.operation.values.nombre || item.operation.values.email || ''} · ${item.error || (item.needsPassword ? 'Requiere contraseña al sincronizar' : 'Pendiente')}`;
                row.appendChild(text);
                if (item.needsPassword && !item.error && !item.registration) {
                    const input = document.createElement('input'); input.type = 'password'; input.placeholder = 'Contraseña (no se guarda)'; input.autocomplete = 'new-password'; input.setAttribute('aria-label', 'Contraseña para sincronizar usuario');
                    const button = document.createElement('button'); button.textContent = 'Completar'; button.onclick = async () => { if (!navigator.onLine) { error.textContent = 'Conéctate para completar este registro.'; return; } const password = input.value; input.value = ''; await offlineApp.complete(item.id, password); }; row.append(input, button);
                }
                if (item.registration) { list.appendChild(row); continue; }
                const discard = document.createElement('button'); discard.textContent = 'Descartar'; discard.onclick = () => { if (confirm('¿Descartar este cambio local pendiente?')) offlineApp.discard(item.id); }; row.appendChild(discard); list.appendChild(row);
            }
        } catch (cause) { panel.hidden = false; error.textContent = 'No se pudo abrir el almacenamiento local: ' + cause.message; }
    }
        panel.querySelector('#confirm-account').onclick = async () => {
        const button = panel.querySelector('#confirm-account');
        const input = panel.querySelector('#local-password');
        const password = input.value; input.value = ''; button.disabled = true;
        try { await localAuth.reconnect(password); error.textContent = ''; await offlineApp.sync(); }
        catch (cause) { error.textContent = cause.message; }
        finally { button.disabled = false; refresh(); }
    };
    document.addEventListener('offline:changed', refresh);
    window.addEventListener('offline', refresh);
    window.addEventListener('online', () => { refresh(); offlineApp.sync(); });
    window.addEventListener('pageshow', () => { refresh(); offlineApp.sync(); });
})();
