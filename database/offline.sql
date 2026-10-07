-- Migración aditiva: no altera ni elimina usuarios, clientes o mascotas.
USE veterinaria_huellitas_felices;
CREATE TABLE IF NOT EXISTS operaciones_offline (
    propietario_id INT UNSIGNED NOT NULL,
    operacion_id CHAR(36) NOT NULL,
    huella CHAR(64) NOT NULL,
    resultado JSON NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (propietario_id, operacion_id)
) ENGINE=InnoDB;
