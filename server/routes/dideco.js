'use strict';

const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { limpiarRut, validarRut } = require('../utils/rut');
const { notificar } = require('../utils/notificar');

const router = express.Router();
const estadosSolicitud = new Set([
  'enviada',
  'en_revision',
  'devuelta',
  'bus_asignado',
  'decreto_firmado',
  'rechazada'
]);
const estadosConBus = ['bus_asignado', 'decreto_firmado'];

function crearError(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function obtenerIdSolicitud(valor) {
  if (!/^[1-9]\d*$/.test(valor)) {
    throw crearError(400, 'El número de solicitud no es válido.');
  }

  const id = Number(valor);
  if (!Number.isSafeInteger(id)) {
    throw crearError(400, 'El número de solicitud no es válido.');
  }

  return id;
}

function validarFecha(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw crearError(400, 'La fecha debe tener el formato AAAA-MM-DD.');
  }

  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fecha.getUTCFullYear() !== anio
    || fecha.getUTCMonth() !== mes - 1
    || fecha.getUTCDate() !== dia
  ) {
    throw crearError(400, 'La fecha indicada no es válida.');
  }

  return valor;
}

function sumarDias(fechaIso, cantidad) {
  const fecha = new Date(`${fechaIso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + cantidad);
  return fecha.toISOString().slice(0, 10);
}

function obtenerLunes(fechaIso) {
  const fecha = new Date(`${fechaIso}T00:00:00Z`);
  const diasDesdeLunes = (fecha.getUTCDay() + 6) % 7;
  fecha.setUTCDate(fecha.getUTCDate() - diasDesdeLunes);
  return fecha.toISOString().slice(0, 10);
}

async function conTransaccion(operacion) {
  const conexion = await pool.getConnection();
  let iniciada = false;

  try {
    await conexion.beginTransaction();
    iniciada = true;
    const resultado = await operacion(conexion);
    await conexion.commit();
    iniciada = false;
    return resultado;
  } catch (error) {
    if (iniciada) {
      try {
        await conexion.rollback();
      } catch (errorRollback) {
        console.error('No fue posible revertir la transacción DIDECO.', errorRollback);
      }
    }
    throw error;
  } finally {
    conexion.release();
  }
}

async function obtenerSolicitudBloqueada(conexion, id) {
  const [filas] = await conexion.execute(
    `SELECT id, folio, organizacion_id, dirigente_id, destino, fecha_salida,
            hora_salida, hora_regreso, motivo, estado, bus_id
     FROM solicitudes
     WHERE id = ?
     FOR UPDATE`,
    [id]
  );

  if (filas.length === 0) {
    throw crearError(404, 'No encontramos esa solicitud.');
  }
  return filas[0];
}

function validarComentario(valor) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw crearError(400, 'Escriba un comentario para explicar la devolución o el rechazo.');
  }
  const comentario = valor.trim();
  if (comentario.length > 2000) {
    throw crearError(400, 'El comentario no puede superar los 2.000 caracteres.');
  }
  return comentario;
}

async function registrarCambio(conexion, solicitud, estadoNuevo, comentario, usuarioId) {
  await conexion.execute(
    `UPDATE solicitudes
     SET estado = ?, observacion_dideco = ?
     WHERE id = ?`,
    [estadoNuevo, comentario || null, solicitud.id]
  );
  await conexion.execute(
    `INSERT INTO historial_estados
       (solicitud_id, estado_anterior, estado_nuevo, usuario_id, comentario)
     VALUES (?, ?, ?, ?, ?)`,
    [solicitud.id, solicitud.estado, estadoNuevo, usuarioId, comentario || null]
  );
}

function obtenerEstadoRuts(pasajeros) {
  const vistos = new Set();
  return pasajeros.map((pasajero) => {
    const rut = pasajero.rut ? limpiarRut(pasajero.rut) : '';
    const rutDuplicado = Boolean(rut && vistos.has(rut));
    if (rut) {
      vistos.add(rut);
    }
    return {
      ...pasajero,
      rut_valido: validarRut(rut),
      rut_duplicado: rutDuplicado
    };
  });
}

function resolverAsignacionesSugeridas(solicitudes, busesLibres) {
  const busPorSolicitud = new Map();
  const solicitudPorBus = new Map();
  const ordenadas = [...solicitudes].sort(
    (a, b) => Number(b.cantidad_pasajeros) - Number(a.cantidad_pasajeros)
  );

  function asignar(solicitud, busesVisitados) {
    const candidatos = busesLibres
      .filter((bus) => Number(bus.asientos) >= Number(solicitud.cantidad_pasajeros))
      .sort((a, b) => Number(a.asientos) - Number(b.asientos));

    for (const bus of candidatos) {
      if (busesVisitados.has(bus.id)) {
        continue;
      }
      busesVisitados.add(bus.id);
      const solicitudActual = solicitudPorBus.get(bus.id);
      if (!solicitudActual || asignar(solicitudActual, busesVisitados)) {
        solicitudPorBus.set(bus.id, solicitud);
        busPorSolicitud.set(solicitud.id, bus);
        return true;
      }
    }
    return false;
  }

  ordenadas.forEach((solicitud) => asignar(solicitud, new Set()));
  return busPorSolicitud;
}

function obtenerConflictos(solicitudesPendientes, busesActivos, solicitudesAsignadas) {
  const ocupadosPorFecha = new Map();
  solicitudesAsignadas.forEach((solicitud) => {
    if (!ocupadosPorFecha.has(solicitud.fecha_salida)) {
      ocupadosPorFecha.set(solicitud.fecha_salida, new Set());
    }
    ocupadosPorFecha.get(solicitud.fecha_salida).add(Number(solicitud.bus_id));
  });

  const pendientesPorFecha = new Map();
  solicitudesPendientes.forEach((solicitud) => {
    if (!pendientesPorFecha.has(solicitud.fecha_salida)) {
      pendientesPorFecha.set(solicitud.fecha_salida, []);
    }
    pendientesPorFecha.get(solicitud.fecha_salida).push(solicitud);
  });

  const analisis = [];
  pendientesPorFecha.forEach((solicitudes, fecha) => {
    const ocupados = ocupadosPorFecha.get(fecha) || new Set();
    const busesLibres = busesActivos.filter((bus) => !ocupados.has(Number(bus.id)));
    const asignaciones = resolverAsignacionesSugeridas(solicitudes, busesLibres);
    const asignacionesSugeridas = solicitudes
      .filter((solicitud) => asignaciones.has(solicitud.id))
      .map((solicitud) => ({
        solicitud_id: solicitud.id,
        folio: solicitud.folio,
        bus: asignaciones.get(solicitud.id)
      }));

    analisis.push({
      fecha,
      conflicto: asignaciones.size < solicitudes.length,
      solicitudes_pendientes: solicitudes,
      buses_libres: busesLibres,
      asignaciones_sugeridas: asignacionesSugeridas,
      solicitudes_sin_bus: solicitudes
        .filter((solicitud) => !asignaciones.has(solicitud.id))
    });
  });

  return analisis.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

async function obtenerConflictosFuturos() {
  const [pendientes] = await pool.execute(
    `SELECT s.id, s.folio, s.fecha_salida,
            (SELECT COUNT(*) FROM pasajeros p WHERE p.solicitud_id = s.id)
              AS cantidad_pasajeros
     FROM solicitudes s
     WHERE s.estado IN ('enviada', 'en_revision')
       AND s.bus_id IS NULL
       AND s.fecha_salida >= CURDATE()
     ORDER BY s.fecha_salida, s.id`
  );
  const [buses] = await pool.execute(
    `SELECT id, nombre, patente, asientos
     FROM buses
     WHERE activo = 1
     ORDER BY asientos, id`
  );
  const [asignadas] = await pool.execute(
    `SELECT fecha_salida, bus_id
     FROM solicitudes
     WHERE estado IN ('bus_asignado', 'decreto_firmado')
       AND bus_id IS NOT NULL
       AND fecha_salida >= CURDATE()`
  );

  return obtenerConflictos(pendientes, buses, asignadas);
}

router.use(requireRole('dideco'));

router.get('/solicitudes', async (req, res, next) => {
  try {
    const condiciones = [`s.estado <> 'borrador'`];
    const parametros = [];
    const estado = req.query.estado || '';
    const buscar = req.query.buscar === undefined ? '' : req.query.buscar;

    if (estado && (!estadosSolicitud.has(estado) || estado === 'borrador')) {
      throw crearError(400, 'Seleccione un estado válido para filtrar.');
    }
    if (estado) {
      condiciones.push('s.estado = ?');
      parametros.push(estado);
    }
    if (typeof buscar !== 'string' || buscar.trim().length > 100) {
      throw crearError(400, 'La búsqueda no puede superar los 100 caracteres.');
    }
    if (buscar.trim()) {
      const termino = `%${buscar.trim()}%`;
      condiciones.push(
        `(s.folio LIKE ? OR s.destino LIKE ? OR o.nombre LIKE ?
          OR u.nombre LIKE ? OR u.rut LIKE ?)`
      );
      parametros.push(termino, termino, termino, termino, termino);
    }

    const [filas] = await pool.execute(
      `SELECT s.id, s.folio, s.destino, s.fecha_salida, s.hora_salida,
              s.estado, s.created_at, o.nombre AS organizacion_nombre,
              u.nombre AS dirigente_nombre, b.id AS bus_id,
              b.nombre AS bus_nombre, b.patente AS bus_patente,
              d.estado AS decreto_estado,
              (SELECT COUNT(*) FROM pasajeros p WHERE p.solicitud_id = s.id)
                AS cantidad_pasajeros
       FROM solicitudes s
       JOIN organizaciones o ON o.id = s.organizacion_id
       JOIN usuarios u ON u.id = s.dirigente_id
       LEFT JOIN buses b ON b.id = s.bus_id
       LEFT JOIN decretos d ON d.solicitud_id = s.id
       WHERE ${condiciones.join(' AND ')}
       ORDER BY FIELD(s.estado, 'enviada', 'en_revision', 'devuelta',
                      'bus_asignado', 'decreto_firmado', 'rechazada'),
                s.fecha_salida, s.created_at DESC, s.id DESC`,
      parametros
    );

    return res.json({ ok: true, data: filas });
  } catch (error) {
    return next(error);
  }
});

router.get('/indicadores', async (req, res, next) => {
  try {
    const [[conteos]] = await pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM solicitudes WHERE estado = 'enviada')
           AS por_revisar,
         (SELECT COUNT(*)
          FROM solicitudes s
          LEFT JOIN decretos d ON d.solicitud_id = s.id
          WHERE s.estado = 'bus_asignado'
            AND (d.id IS NULL OR d.estado = 'pendiente'))
           AS esperando_decreto`
    );
    const [[tiempoRespuesta]] = await pool.execute(
      `SELECT ROUND(AVG(
         TIMESTAMPDIFF(SECOND, enviada.fecha, revision.fecha) / 86400
       ), 1) AS promedio_dias
       FROM (
         SELECT solicitud_id, MIN(created_at) AS fecha
         FROM historial_estados
         WHERE estado_nuevo = 'enviada'
         GROUP BY solicitud_id
       ) enviada
       JOIN (
         SELECT solicitud_id, MIN(created_at) AS fecha
         FROM historial_estados
         WHERE estado_nuevo = 'en_revision'
         GROUP BY solicitud_id
       ) revision ON revision.solicitud_id = enviada.solicitud_id
       WHERE revision.fecha >= enviada.fecha`
    );
    const conflictos = await obtenerConflictosFuturos();

    return res.json({
      ok: true,
      data: {
        por_revisar: Number(conteos.por_revisar),
        tiempo_medio_respuesta_dias: Number(tiempoRespuesta.promedio_dias || 0),
        esperando_decreto: Number(conteos.esperando_decreto),
        conflictos_fecha: conflictos.filter((item) => item.conflicto).length
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/calendario', async (req, res, next) => {
  try {
    let desde;
    if (req.query.desde === undefined) {
      const [filasHoy] = await pool.query(
        `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy`
      );
      desde = filasHoy[0].hoy;
    } else {
      desde = validarFecha(req.query.desde);
    }

    const lunes = obtenerLunes(desde);
    const domingo = sumarDias(lunes, 6);
    const dias = Array.from({ length: 7 }, (_valor, indice) => sumarDias(lunes, indice));
    const [buses] = await pool.execute(
      `SELECT b.id, b.nombre, b.patente, b.asientos, b.activo
       FROM buses b
       WHERE b.activo = 1
          OR EXISTS (
            SELECT 1
            FROM solicitudes s
            WHERE s.bus_id = b.id
              AND s.fecha_salida BETWEEN ? AND ?
              AND s.estado IN ('bus_asignado', 'decreto_firmado')
          )
       ORDER BY b.nombre, b.id`,
      [lunes, domingo]
    );
    const [asignadas] = await pool.execute(
      `SELECT s.id, s.folio, s.destino, s.fecha_salida, s.estado, s.bus_id,
              o.nombre AS organizacion_nombre, b.nombre AS bus_nombre,
              (SELECT COUNT(*) FROM pasajeros p WHERE p.solicitud_id = s.id)
                AS cantidad_pasajeros
       FROM solicitudes s
       JOIN organizaciones o ON o.id = s.organizacion_id
       JOIN buses b ON b.id = s.bus_id
       WHERE s.estado IN ('bus_asignado', 'decreto_firmado')
         AND s.fecha_salida BETWEEN ? AND ?
       ORDER BY s.fecha_salida, b.nombre, s.id`,
      [lunes, domingo]
    );
    const [pendientes] = await pool.execute(
      `SELECT s.id, s.folio, s.destino, s.fecha_salida, s.estado,
              o.nombre AS organizacion_nombre,
              (SELECT COUNT(*) FROM pasajeros p WHERE p.solicitud_id = s.id)
                AS cantidad_pasajeros
       FROM solicitudes s
       JOIN organizaciones o ON o.id = s.organizacion_id
       WHERE s.estado IN ('enviada', 'en_revision')
         AND s.bus_id IS NULL
         AND s.fecha_salida BETWEEN ? AND ?
       ORDER BY s.fecha_salida, s.id`,
      [lunes, domingo]
    );
    const activos = buses.filter((bus) => Number(bus.activo) === 1);
    const analisis = obtenerConflictos(pendientes, activos, asignadas);
    const analisisPorFecha = new Map(analisis.map((item) => [item.fecha, item]));
    const asignadasPorBus = new Map();

    asignadas.forEach((solicitud) => {
      const busId = Number(solicitud.bus_id);
      if (!asignadasPorBus.has(busId)) {
        asignadasPorBus.set(busId, new Map());
      }
      const porFecha = asignadasPorBus.get(busId);
      if (!porFecha.has(solicitud.fecha_salida)) {
        porFecha.set(solicitud.fecha_salida, []);
      }
      porFecha.get(solicitud.fecha_salida).push(solicitud);
    });

    const filasBuses = buses.map((bus) => ({
      ...bus,
      dias: dias.map((fecha) => ({
        fecha,
        conflicto: Boolean(analisisPorFecha.get(fecha)?.conflicto),
        solicitudes: asignadasPorBus.get(Number(bus.id))?.get(fecha) || []
      }))
    }));
    const pendientesPorDia = dias.map((fecha) => {
      const detalle = analisisPorFecha.get(fecha);
      const sugerencias = new Map(
        (detalle ? detalle.asignaciones_sugeridas : [])
          .map((item) => [Number(item.solicitud_id), item.bus])
      );
      return {
        fecha,
        conflicto: Boolean(detalle && detalle.conflicto),
        sugerencia: detalle && detalle.asignaciones_sugeridas.length
          ? detalle.asignaciones_sugeridas[0]
          : null,
        solicitudes: (detalle ? detalle.solicitudes_pendientes : []).map((solicitud) => ({
          ...solicitud,
          bus_sugerido: sugerencias.get(Number(solicitud.id)) || null
        }))
      };
    });

    return res.json({
      ok: true,
      data: {
        semana: { desde: lunes, hasta: domingo },
        dias,
        buses: filasBuses,
        pendientes_por_dia: pendientesPorDia,
        choques: analisis.filter((item) => item.conflicto)
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/solicitudes/:id', async (req, res, next) => {
  try {
    const id = obtenerIdSolicitud(req.params.id);
    const [filas] = await pool.execute(
      `SELECT s.id, s.folio, s.organizacion_id, s.dirigente_id, s.destino,
              s.fecha_salida, s.hora_salida, s.hora_regreso, s.motivo,
              s.estado, s.bus_id, s.observacion_dideco, s.created_at,
              o.nombre AS organizacion_nombre, o.sector AS organizacion_sector,
              u.nombre AS dirigente_nombre, u.rut AS dirigente_rut,
              b.nombre AS bus_nombre, b.patente AS bus_patente,
              b.asientos AS bus_asientos, d.id AS decreto_id,
              d.estado AS decreto_estado
       FROM solicitudes s
       JOIN organizaciones o ON o.id = s.organizacion_id
       JOIN usuarios u ON u.id = s.dirigente_id
       LEFT JOIN buses b ON b.id = s.bus_id
       LEFT JOIN decretos d ON d.solicitud_id = s.id
       WHERE s.id = ?
       LIMIT 1`,
      [id]
    );

    if (filas.length === 0 || filas[0].estado === 'borrador') {
      throw crearError(404, 'No encontramos esa solicitud recibida.');
    }

    const solicitud = filas[0];
    const [pasajerosDB] = await pool.execute(
      `SELECT id, nombre, rut
       FROM pasajeros
       WHERE solicitud_id = ?
       ORDER BY id`,
      [id]
    );
    const pasajeros = obtenerEstadoRuts(pasajerosDB);
    const [historial] = await pool.execute(
      `SELECT h.estado_anterior, h.estado_nuevo, h.comentario, h.created_at,
              u.nombre AS usuario_nombre
       FROM historial_estados h
       LEFT JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.solicitud_id = ?
       ORDER BY h.created_at, h.id`,
      [id]
    );
    let busesDisponibles = [];

    if (solicitud.estado === 'en_revision' && solicitud.fecha_salida) {
      [busesDisponibles] = await pool.execute(
        `SELECT b.id, b.nombre, b.patente, b.asientos
         FROM buses b
         WHERE b.activo = 1
           AND b.asientos >= ?
           AND NOT EXISTS (
             SELECT 1
             FROM solicitudes ocupada
             WHERE ocupada.bus_id = b.id
               AND ocupada.fecha_salida = ?
               AND ocupada.estado IN ('bus_asignado', 'decreto_firmado')
           )
         ORDER BY b.asientos, b.nombre`,
        [pasajeros.length, solicitud.fecha_salida]
      );
    }

    return res.json({
      ok: true,
      data: {
        solicitud: {
          id: solicitud.id,
          folio: solicitud.folio,
          destino: solicitud.destino,
          fecha_salida: solicitud.fecha_salida,
          hora_salida: solicitud.hora_salida,
          hora_regreso: solicitud.hora_regreso,
          motivo: solicitud.motivo,
          estado: solicitud.estado,
          observacion_dideco: solicitud.observacion_dideco,
          created_at: solicitud.created_at,
          organizacion: {
            id: solicitud.organizacion_id,
            nombre: solicitud.organizacion_nombre,
            sector: solicitud.organizacion_sector
          },
          dirigente: {
            id: solicitud.dirigente_id,
            nombre: solicitud.dirigente_nombre,
            rut: solicitud.dirigente_rut
          }
        },
        bus: solicitud.bus_id
          ? {
            id: solicitud.bus_id,
            nombre: solicitud.bus_nombre,
            patente: solicitud.bus_patente,
            asientos: solicitud.bus_asientos
          }
          : null,
        pasajeros,
        historial,
        decreto: solicitud.decreto_id
          ? { id: solicitud.decreto_id, estado: solicitud.decreto_estado }
          : null,
        buses_disponibles: busesDisponibles
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/solicitudes/:id/revision', async (req, res, next) => {
  try {
    const id = obtenerIdSolicitud(req.params.id);
    const resultado = await conTransaccion(async (conexion) => {
      const solicitud = await obtenerSolicitudBloqueada(conexion, id);
      if (solicitud.estado !== 'enviada') {
        throw crearError(409, 'Solo puede iniciar la revisión de una solicitud enviada.');
      }

      await registrarCambio(
        conexion,
        solicitud,
        'en_revision',
        'DIDECO inició la revisión.',
        req.usuario.id
      );
      return {
        id,
        folio: solicitud.folio,
        dirigente_id: solicitud.dirigente_id,
        estado: 'en_revision'
      };
    });

    await notificar(
      resultado.dirigente_id,
      resultado.id,
      `Su solicitud ${resultado.folio} está en revisión por DIDECO.`
    );

    return res.json({ ok: true, data: resultado });
  } catch (error) {
    return next(error);
  }
});

router.post('/solicitudes/:id/asignar-bus', async (req, res, next) => {
  try {
    const id = obtenerIdSolicitud(req.params.id);
    const busId = Number(req.body && req.body.bus_id);
    if (!Number.isSafeInteger(busId) || busId < 1) {
      throw crearError(400, 'Seleccione un bus válido.');
    }

    const resultado = await conTransaccion(async (conexion) => {
      const solicitud = await obtenerSolicitudBloqueada(conexion, id);
      if (solicitud.estado !== 'en_revision') {
        throw crearError(409, 'Solo puede asignar un bus a una solicitud en revisión.');
      }
      if (!solicitud.fecha_salida) {
        throw crearError(409, 'La solicitud no tiene una fecha de salida válida.');
      }

      const [filasBus] = await conexion.execute(
        `SELECT id, nombre, patente, asientos, activo
         FROM buses
         WHERE id = ?
         FOR UPDATE`,
        [busId]
      );
      if (filasBus.length === 0) {
        throw crearError(404, 'No encontramos el bus seleccionado.');
      }
      const bus = filasBus[0];
      if (Number(bus.activo) !== 1) {
        throw crearError(409, 'El bus seleccionado no está activo.');
      }

      const [pasajeros] = await conexion.execute(
        `SELECT nombre, rut
         FROM pasajeros
         WHERE solicitud_id = ?
         ORDER BY id`,
        [id]
      );
      if (pasajeros.length === 0 || pasajeros.length > 36) {
        throw crearError(409, 'La nómina debe tener entre 1 y 36 pasajeros antes de asignar un bus.');
      }
      const pasajerosValidados = obtenerEstadoRuts(pasajeros);
      if (pasajerosValidados.some((pasajero) => (
        !pasajero.nombre
        || !pasajero.rut_valido
        || pasajero.rut_duplicado
      ))) {
        throw crearError(409, 'La nómina contiene nombres o RUT que deben corregirse antes de asignar el bus.');
      }
      if (pasajeros.length > Number(bus.asientos)) {
        throw crearError(
          409,
          `El bus ${bus.nombre} tiene ${bus.asientos} asientos y no alcanza para ${pasajeros.length} pasajeros.`
        );
      }

      const [reservas] = await conexion.execute(
        `SELECT id, folio
         FROM solicitudes
         WHERE bus_id = ?
           AND fecha_salida = ?
           AND estado IN ('bus_asignado', 'decreto_firmado')
           AND id <> ?
         FOR UPDATE`,
        [busId, solicitud.fecha_salida, id]
      );
      if (reservas.length > 0) {
        throw crearError(
          409,
          `El ${bus.nombre} ya está asignado ese día a la solicitud ${reservas[0].folio}. Elija otro bus.`
        );
      }

      const [decretos] = await conexion.execute(
        `SELECT id, estado
         FROM decretos
         WHERE solicitud_id = ?
         FOR UPDATE`,
        [id]
      );
      if (decretos.length > 0 && decretos[0].estado !== 'devuelto') {
        throw crearError(409, 'La solicitud ya tiene un decreto asociado. Revise su estado antes de continuar.');
      }
      const [organizaciones] = await conexion.execute(
        `SELECT nombre, sector
         FROM organizaciones
         WHERE id = ?`,
        [solicitud.organizacion_id]
      );
      const contenido = {
        folio: solicitud.folio,
        organizacion: organizaciones[0] || null,
        destino: solicitud.destino,
        fecha_salida: solicitud.fecha_salida,
        hora_salida: solicitud.hora_salida,
        hora_regreso: solicitud.hora_regreso,
        motivo: solicitud.motivo,
        bus: {
          id: bus.id,
          nombre: bus.nombre,
          patente: bus.patente,
          asientos: bus.asientos
        },
        pasajeros: pasajeros.map((pasajero) => ({
          nombre: pasajero.nombre,
          rut: limpiarRut(pasajero.rut)
        }))
      };

      if (decretos.length > 0) {
        await conexion.execute(
          `UPDATE decretos
           SET contenido = ?, estado = 'pendiente', numero = NULL,
               firmante_id = NULL, firmado_at = NULL, hash_firma = NULL,
               observacion = NULL
           WHERE id = ?`,
          [JSON.stringify(contenido), decretos[0].id]
        );
      } else {
        await conexion.execute(
          `INSERT INTO decretos (solicitud_id, contenido, estado)
           VALUES (?, ?, 'pendiente')`,
          [id, JSON.stringify(contenido)]
        );
      }
      await conexion.execute(
        `UPDATE solicitudes
         SET bus_id = ?, estado = 'bus_asignado', observacion_dideco = NULL
         WHERE id = ?`,
        [busId, id]
      );
      await conexion.execute(
        `INSERT INTO historial_estados
           (solicitud_id, estado_anterior, estado_nuevo, usuario_id, comentario)
         VALUES (?, 'en_revision', 'bus_asignado', ?, ?)`,
        [id, req.usuario.id, `Se asignó ${bus.nombre}; decreto pendiente.`]
      );
      return {
        id,
        folio: solicitud.folio,
        dirigente_id: solicitud.dirigente_id,
        bus_nombre: bus.nombre,
        estado: 'bus_asignado',
        bus: { id: bus.id, nombre: bus.nombre, patente: bus.patente }
      };
    });

    await notificar(
      resultado.dirigente_id,
      resultado.id,
      `Su solicitud ${resultado.folio} ya tiene bus asignado: ${resultado.bus_nombre}.`
    );
    const [administradores] = await pool.execute(
      `SELECT id
       FROM usuarios
       WHERE rol = 'administrador' AND activo = 1`
    );
    for (const administrador of administradores) {
      await notificar(
        administrador.id,
        resultado.id,
        `La solicitud ${resultado.folio} tiene bus asignado y el decreto está pendiente.`
      );
    }

    return res.json({ ok: true, data: resultado });
  } catch (error) {
    return next(error);
  }
});

async function resolverDecision(req, res, next, estadoNuevo, accion) {
  try {
    const id = obtenerIdSolicitud(req.params.id);
    const comentario = validarComentario(req.body && req.body.comentario);
    const resultado = await conTransaccion(async (conexion) => {
      const solicitud = await obtenerSolicitudBloqueada(conexion, id);
      if (solicitud.estado !== 'en_revision') {
        throw crearError(409, `Solo puede ${accion} una solicitud que está en revisión.`);
      }

      await registrarCambio(
        conexion,
        solicitud,
        estadoNuevo,
        comentario,
        req.usuario.id
      );
      return {
        id,
        folio: solicitud.folio,
        dirigente_id: solicitud.dirigente_id,
        estado: estadoNuevo,
        comentario
      };
    });
    const mensaje = estadoNuevo === 'rechazada'
      ? `Su solicitud ${resultado.folio} fue rechazada. ${resultado.comentario}`
      : `Su solicitud ${resultado.folio} fue devuelta para corregir. ${resultado.comentario}`;
    await notificar(resultado.dirigente_id, resultado.id, mensaje);
    return res.json({ ok: true, data: resultado });
  } catch (error) {
    return next(error);
  }
}

router.post('/solicitudes/:id/rechazar', (req, res, next) => (
  resolverDecision(req, res, next, 'rechazada', 'rechazar')
));

router.post('/solicitudes/:id/devolver', (req, res, next) => (
  resolverDecision(req, res, next, 'devuelta', 'devolver')
));

module.exports = router;
