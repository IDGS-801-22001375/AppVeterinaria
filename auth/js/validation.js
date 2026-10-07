(function (root, factory) {
    const validation = factory();
    if (typeof module === 'object' && module.exports) module.exports = validation;
    else root.authValidation = validation;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const clean = value => typeof value === 'string' ? value.trim() : '';
    function validate(body, mode) {
        body = body && typeof body === 'object' ? body : {};
        const values = {
            email: clean(body.email).toLowerCase(),
            password: typeof body.password === 'string' ? body.password : '',
            nombre: clean(body.nombre), apellido: clean(body.apellido),
            telefono: clean(body.telefono), direccion: clean(body.direccion)
        };
        const errors = {};
        if (!values.email) errors.email = 'Escribe tu correo electrónico.';
        else if (values.email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Escribe un correo electrónico válido (máximo 150 caracteres).';
        if (!values.password.trim()) errors.password = 'Escribe tu contraseña.';
        else {
            const bytes = Array.from(values.password).reduce((size, character) => {
                const code = character.codePointAt(0);
                return size + (code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4);
            }, 0);
            if (bytes > 72) errors.password = 'La contraseña supera el límite de 72 bytes; usa menos caracteres.';
            else if (mode === 'register' && values.password.length < 8) errors.password = 'La contraseña debe tener al menos 8 caracteres.';
        }
        if (mode === 'register') {
            for (const field of ['nombre', 'apellido']) {
                const label = field === 'nombre' ? 'nombre' : 'apellido';
                if (!values[field]) errors[field] = `Escribe tu ${label}.`;
                else if (values[field].length > 80 || !/^[\p{L}\p{M} '\u2019-]+$/u.test(values[field])) errors[field] = `El ${label} debe contener letras, espacios, apóstrofes o guiones (máximo 80 caracteres).`;
            }
            if (body.telefono != null && typeof body.telefono !== 'string') errors.telefono = 'Escribe un teléfono válido.';
            else if (values.telefono && (values.telefono.length > 30 || !/^\+?[\d\s().-]+$/.test(values.telefono) || !/^\d{7,15}$/.test(values.telefono.replace(/\D/g, '')))) errors.telefono = 'El teléfono debe contener entre 7 y 15 dígitos; puedes usar +, espacios, paréntesis y guiones.';
            if ((body.direccion != null && typeof body.direccion !== 'string') || values.direccion.length > 200) errors.direccion = 'La dirección debe tener como máximo 200 caracteres.';
        }
        return { values, errors };
    }
    return { validate };
});
