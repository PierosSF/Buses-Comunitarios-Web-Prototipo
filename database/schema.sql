-- Esquema de la plataforma de Buses Comunitarios.
CREATE DATABASE IF NOT EXISTS buses_comunitarios
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

ALTER DATABASE buses_comunitarios
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE buses_comunitarios;

CREATE TABLE IF NOT EXISTS organizaciones (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(150) NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  sector VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_organizaciones_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  rut VARCHAR(12) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('dirigente', 'dideco', 'administrador') NOT NULL,
  organizacion_id INT UNSIGNED NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_rut (rut),
  UNIQUE KEY uq_usuarios_email (email),
  KEY ix_usuarios_organizacion (organizacion_id),
  CONSTRAINT fk_usuarios_organizacion
    FOREIGN KEY (organizacion_id) REFERENCES organizaciones (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS buses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  patente VARCHAR(10) NOT NULL,
  asientos TINYINT UNSIGNED NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_buses_patente (patente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contador interno para generar folios correlativos sin colisiones concurrentes.
CREATE TABLE IF NOT EXISTS secuencias_folios (
  anio SMALLINT UNSIGNED NOT NULL,
  ultimo INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (anio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contador anual para emitir decretos de circulación sin duplicar números.
CREATE TABLE IF NOT EXISTS secuencias_decretos (
  anio SMALLINT UNSIGNED NOT NULL,
  ultimo INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (anio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS solicitudes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  folio VARCHAR(9) NOT NULL,
  organizacion_id INT UNSIGNED NOT NULL,
  dirigente_id INT UNSIGNED NOT NULL,
  destino VARCHAR(200) NULL,
  fecha_salida DATE NULL,
  hora_salida TIME NULL,
  hora_regreso TIME NULL,
  motivo ENUM('recreativa', 'deportiva', 'cultural', 'educativa') NULL,
  estado ENUM(
    'borrador',
    'enviada',
    'en_revision',
    'devuelta',
    'bus_asignado',
    'decreto_firmado',
    'rechazada'
  ) NOT NULL DEFAULT 'borrador',
  bus_id INT UNSIGNED NULL,
  observacion_dideco TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_solicitudes_folio (folio),
  KEY ix_solicitudes_fecha_bus (fecha_salida, bus_id),
  KEY ix_solicitudes_organizacion_fecha (organizacion_id, fecha_salida),
  KEY ix_solicitudes_estado_fecha (estado, fecha_salida),
  CONSTRAINT fk_solicitudes_organizacion
    FOREIGN KEY (organizacion_id) REFERENCES organizaciones (id),
  CONSTRAINT fk_solicitudes_dirigente
    FOREIGN KEY (dirigente_id) REFERENCES usuarios (id),
  CONSTRAINT fk_solicitudes_bus
    FOREIGN KEY (bus_id) REFERENCES buses (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pasajeros (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  solicitud_id INT UNSIGNED NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  rut VARCHAR(12) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pasajeros_solicitud_rut (solicitud_id, rut),
  CONSTRAINT fk_pasajeros_solicitud
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS decretos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  solicitud_id INT UNSIGNED NOT NULL,
  numero VARCHAR(50) NULL,
  contenido JSON NOT NULL,
  estado ENUM('pendiente', 'firmado', 'devuelto') NOT NULL DEFAULT 'pendiente',
  firmante_id INT UNSIGNED NULL,
  firmado_at DATETIME NULL,
  hash_firma VARCHAR(255) NULL,
  observacion TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_decretos_solicitud (solicitud_id),
  KEY ix_decretos_estado (estado),
  CONSTRAINT fk_decretos_solicitud
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes (id),
  CONSTRAINT fk_decretos_firmante
    FOREIGN KEY (firmante_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS historial_estados (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  solicitud_id INT UNSIGNED NOT NULL,
  estado_anterior VARCHAR(30) NULL,
  estado_nuevo VARCHAR(30) NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  comentario TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_historial_solicitud_fecha (solicitud_id, created_at),
  CONSTRAINT fk_historial_solicitud
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes (id),
  CONSTRAINT fk_historial_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notificaciones (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  solicitud_id INT UNSIGNED NULL,
  mensaje VARCHAR(500) NOT NULL,
  canal ENUM('app', 'correo_simulado') NOT NULL DEFAULT 'app',
  leida TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_notificaciones_usuario_leida_fecha (usuario_id, leida, created_at),
  CONSTRAINT fk_notificaciones_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_notificaciones_solicitud
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permite guardar borradores incompletos; el envío exige validar estos campos.
ALTER TABLE solicitudes
  MODIFY destino VARCHAR(200) NULL,
  MODIFY fecha_salida DATE NULL,
  MODIFY hora_salida TIME NULL,
  MODIFY hora_regreso TIME NULL,
  MODIFY motivo ENUM('recreativa', 'deportiva', 'cultural', 'educativa') NULL;

ALTER TABLE pasajeros
  MODIFY nombre VARCHAR(150) NULL,
  MODIFY rut VARCHAR(12) NULL;

-- Permite que DIDECO devuelva una solicitud al dirigente para corregirla.
ALTER TABLE solicitudes
  MODIFY estado ENUM(
    'borrador',
    'enviada',
    'en_revision',
    'devuelta',
    'bus_asignado',
    'decreto_firmado',
    'rechazada'
  ) NOT NULL DEFAULT 'borrador';
