CREATE DATABASE IF NOT EXISTS veterinaria_huellitas_felices
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE veterinaria_huellitas_felices;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('admin', 'cliente') NOT NULL DEFAULT 'cliente',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clientes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT UNSIGNED NOT NULL UNIQUE,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    telefono VARCHAR(30),
    direccion VARCHAR(200),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cliente_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mascotas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT UNSIGNED NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    especie VARCHAR(40) NOT NULL DEFAULT 'perro',
    raza VARCHAR(80),
    sexo ENUM('macho', 'hembra'),
    fecha_nacimiento DATE,
    color VARCHAR(50),
    observaciones TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mascota_cliente FOREIGN KEY (cliente_id)
        REFERENCES clientes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- No insertar HASH_GENERADO: el registro genera hashes bcrypt reales.

-- Ejecutar para habilitar sincronización offline sin duplicar registros.
CREATE TABLE IF NOT EXISTS operaciones_offline (
    propietario_id INT UNSIGNED NOT NULL,
    operacion_id CHAR(36) NOT NULL,
    huella CHAR(64) NOT NULL,
    resultado JSON NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (propietario_id, operacion_id)
) ENGINE=InnoDB;
