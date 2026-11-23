-- Datos ficticios para pruebas locales. La clave de todas las cuentas es Demo1234.
-- Los RUT están normalizados, sin puntos, y usan dígitos verificadores válidos.
SET NAMES utf8mb4;
USE buses_comunitarios;

INSERT INTO organizaciones (id, nombre, tipo, sector) VALUES
  (1, 'Junta de Vecinos Nuevo Amanecer', 'Junta de vecinos', 'Padre Las Casas'),
  (2, 'Club de Adulto Mayor Las Araucarias', 'Club de adulto mayor', 'Metrenco'),
  (3, 'Centro de Madres Los Copihues', 'Centro de madres', 'San Ramón'),
  (4, 'Club Deportivo Estrella del Sur', 'Club deportivo', 'Padre Las Casas');

INSERT INTO buses (id, nombre, patente, asientos) VALUES
  (1, 'Bus 1', 'DEMO-001', 36),
  (2, 'Bus 2', 'DEMO-002', 30),
  (3, 'Bus 3', 'DEMO-003', 36);

-- Las cuatro cuentas de demostración comparten la clave Demo1234.
INSERT INTO usuarios
  (id, rut, nombre, email, password_hash, rol, organizacion_id)
VALUES
  (1, '99999980-8', 'Camila Antilef', 'dirigente1@demo.local', '$2a$10$wny7m8bNsIXSZjkZ9oHGOutrYq.UZ6skjqkc5J0kW6XEmntnMIMHu', 'dirigente', 1),
  (2, '99999981-6', 'Pedro Huenchumil', 'dirigente2@demo.local', '$2a$10$wny7m8bNsIXSZjkZ9oHGOutrYq.UZ6skjqkc5J0kW6XEmntnMIMHu', 'dirigente', 2),
  (3, '99999982-4', 'Daniela Morales', 'dideco@demo.local', '$2a$10$wny7m8bNsIXSZjkZ9oHGOutrYq.UZ6skjqkc5J0kW6XEmntnMIMHu', 'dideco', NULL),
  (4, '99999983-2', 'Jorge Paillalef', 'administrador@demo.local', '$2a$10$wny7m8bNsIXSZjkZ9oHGOutrYq.UZ6skjqkc5J0kW6XEmntnMIMHu', 'administrador', NULL);

-- Dos buses quedan ocupados; las dos solicitudes enviadas compiten por el tercero.
-- Las fechas de salida se calculan desde hoy para que la demostración no caduque.
INSERT INTO solicitudes
  (id, folio, organizacion_id, dirigente_id, destino, fecha_salida,
   hora_salida, hora_regreso, motivo, estado, bus_id, observacion_dideco)
VALUES
  (1, '2026-0377', 1, 1, 'Temuco', CURDATE() + INTERVAL 10 DAY,
   '08:00:00', '18:00:00', 'cultural', 'decreto_firmado', 1, NULL),
  (2, '2026-0409', 2, 2, 'Villarrica', CURDATE() + INTERVAL 10 DAY,
   '09:00:00', '19:00:00', 'recreativa', 'bus_asignado', 2, NULL),
  (3, '2026-0412', 1, 1, 'Museo Regional de La Araucanía', CURDATE() + INTERVAL 10 DAY,
   '08:30:00', '17:30:00', 'educativa', 'enviada', NULL, NULL),
  (4, '2026-0415', 2, 2, 'Centro Cultural de Temuco', CURDATE() + INTERVAL 10 DAY,
   '09:00:00', '18:00:00', 'cultural', 'enviada', NULL, NULL),
  (5, '2026-0418', 1, 1, 'Cancha municipal de Padre Las Casas', CURDATE() + INTERVAL 15 DAY,
   '10:00:00', '16:00:00', 'deportiva', 'en_revision', NULL, 'Revisar disponibilidad de pasajeros.');

INSERT INTO pasajeros (solicitud_id, nombre, rut) VALUES
  (1, 'Rosa Catrileo', '99999984-0'),
  (1, 'Luis Ñanculef', '99999985-9'),
  (2, 'Elena Marileo', '99999986-7'),
  (2, 'Héctor Calfulef', '99999987-5'),
  (3, 'Marta Antinao', '99999988-3'),
  (3, 'Juan Curín', '99999989-1'),
  (4, 'Teresa Painemil', '99999990-5'),
  (4, 'Mario Calbucura', '99999991-3'),
  (5, 'Patricia Millanao', '99999992-1'),
  (5, 'Esteban Caniulaf', '99999993-K');

-- Un decreto firmado y uno pendiente para la solicitud con bus asignado.
INSERT INTO decretos
  (id, solicitud_id, numero, contenido, estado, firmante_id, firmado_at, hash_firma, observacion)
VALUES
  (1, 1, 'DCV-2026-00377',
   JSON_OBJECT(
     'folio', '2026-0377',
     'destino', 'Temuco',
     'fecha_salida', DATE_FORMAT(CURDATE() + INTERVAL 10 DAY, '%Y-%m-%d')
   ),
   'firmado', 4, NOW(), 'FIRMA-DEMO-SIN-VALIDEZ-00377', NULL),
  (2, 2, NULL,
   JSON_OBJECT(
     'folio', '2026-0409',
     'destino', 'Villarrica',
     'fecha_salida', DATE_FORMAT(CURDATE() + INTERVAL 10 DAY, '%Y-%m-%d')
   ),
   'pendiente', NULL, NULL, NULL, NULL);

INSERT INTO historial_estados
  (solicitud_id, estado_anterior, estado_nuevo, usuario_id, comentario, created_at)
VALUES
  (1, 'borrador', 'enviada', 1, 'Solicitud enviada por la organización.', NOW() - INTERVAL 6 DAY),
  (1, 'enviada', 'en_revision', 3, 'DIDECO inició la revisión.', NOW() - INTERVAL 5 DAY),
  (1, 'en_revision', 'bus_asignado', 3, 'Se asignó el Bus 1.', NOW() - INTERVAL 4 DAY),
  (1, 'bus_asignado', 'decreto_firmado', 4, 'Decreto de demostración firmado.', NOW() - INTERVAL 3 DAY),
  (2, 'borrador', 'enviada', 2, 'Solicitud enviada por la organización.', NOW() - INTERVAL 5 DAY),
  (2, 'enviada', 'en_revision', 3, 'DIDECO inició la revisión.', NOW() - INTERVAL 4 DAY),
  (2, 'en_revision', 'bus_asignado', 3, 'Se asignó el Bus 2; decreto pendiente.', NOW() - INTERVAL 3 DAY),
  (3, 'borrador', 'enviada', 1, 'Solicitud enviada por la organización.', NOW() - INTERVAL 2 DAY),
  (4, 'borrador', 'enviada', 2, 'Solicitud enviada por la organización.', NOW() - INTERVAL 2 DAY),
  (5, 'borrador', 'enviada', 1, 'Solicitud enviada por la organización.', NOW() - INTERVAL 3 DAY),
  (5, 'enviada', 'en_revision', 3, 'DIDECO inició la revisión.', NOW() - INTERVAL 1 DAY);

INSERT INTO notificaciones
  (usuario_id, solicitud_id, mensaje, canal, leida)
VALUES
  (1, 1, 'Su solicitud 2026-0377 cuenta con decreto firmado.', 'app', 0),
  (2, 2, 'Se asignó un bus a la solicitud 2026-0409. El decreto está pendiente.', 'app', 0),
  (1, 3, 'Recibimos su solicitud 2026-0412.', 'correo_simulado', 1),
  (2, 4, 'Recibimos su solicitud 2026-0415.', 'app', 0),
  (1, 5, 'La solicitud 2026-0418 está en revisión por DIDECO.', 'app', 0);
