'use strict';

const crypto = require('crypto');
const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { limpiarRut, validarRut } = require('../utils/rut');

const router = express.Router();
const estadosDecreto = new Set(['pendiente', 'firmado', 'devuelto']);

function crearError(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function obtenerIdDecreto(valor) {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) {
    throw crearError(400, 'El número de decreto no es válido.');
  }
  const id = Number(valor);
  if (!Number.isSafeInteger(id)) {
    throw crearError(400, 'El número de decreto no es válido.');
  }
  return id;
}

function leerContenido(valor) {
  let contenido = valor;
  if (typeof contenido === 'string') {
    try {
      contenido = JSON.parse(contenido);
    } catch (error) {
      throw crearError(500, 'El contenido guardado del decreto no se puede leer.');
    }
  }
  if (!contenido || typeof contenido !== 'object' || Array.isArray(contenido)) {
    throw crearError(500, 'El contenido guardado del decreto no tiene un formato válido.');
  }
  return contenido;
}

function obtenerPasajerosRevisados(pasajeros) {
  const vistos = new Set();
  return pasajeros.map((pasajero) => {
    const rut = pasajero.rut ? limpiarRut(pasajero.rut) : '';
    const rutDuplicado = Boolean(rut && vistos.has(rut));
    if (rut) {
      vistos.add(rut);
    }
    return {
      ...pasajero,
      rut_normalizado: rut,
      rut_valido: Boolean(rut && validarRut(rut)),
      rut_duplicado: rutDuplicado
    };
  });
}

function crearRevision(expediente, pasajeros, conflictos) {
  const pasajerosValidos = pasajeros.length > 0
    && pasajeros.length <= 36
    && pasajeros.every((pasajero) => (
      Boolean(pasajero.nombre && pasajero.nombre.trim())
      && pasajero.rut_valido
      && !pasajero.rut_duplicado
    ));
  const busValido = Boolean(
    expediente.bus_id
    && Number(expediente.bus_activo) === 1
    && Number(expediente.bus_asientos) >= pasajeros.length
    && conflictos.length === 0
  );
  const datosViajeValidos = Boolean(
    expediente.motivo
    && expediente.destino
    && expediente.fecha_salida
    && expediente.hora_salida
    && expediente.hora_regreso
  );
  const minutosRestantes = expediente.minutos_restantes === null
    ? null
    : Number(expediente.minutos_restantes);
  const horasRestantes = minutosRestantes === null
    ? null
    : Math.round((minutosRestantes / 60) * 10) / 10;

  const checks = [
    {
      clave: 'nomina',
      etiqueta: 'Nómina y RUT',
      ok: pasajerosValidos,
      detalle: pasajerosValidos
        ? `${pasajeros.length} pasajero(s); todos los RUT son válidos y no se repiten.`
        : 'Debe haber entre 1 y 36 pasajeros, con nombre y RUT válido no repetido.'
    },
    {
      clave: 'bus',
      etiqueta: 'Bus y disponibilidad',
      ok: busValido,
      detalle: !expediente.bus_id
        ? 'La solicitud no tiene bus asignado.'
        : Number(expediente.bus_activo) !== 1
          ? 'El bus asignado no está activo.'
          : Number(expediente.bus_asientos) < pasajeros.length
            ? `El bus tiene ${expediente.bus_asientos} asientos para ${pasajeros.length} pasajeros.`
            : conflictos.length
              ? `El bus tiene ${conflictos.length} reserva(s) coincidente(s) para esa fecha.`
              : `${expediente.bus_nombre} (${expediente.bus_patente}) está disponible y tiene capacidad suficiente.`
    },
    {
      clave: 'datos_viaje',
      etiqueta: 'Motivo y datos del viaje',
      ok: datosViajeValidos,
      detalle: datosViajeValidos
        ? `Motivo: ${expediente.motivo}.`
        : 'Falta indicar el motivo o completar los datos del viaje.'
    }
  ];
  const advertencia48Horas = minutosRestantes !== null && minutosRestantes < 48 * 60;

  return {
    checks,
    puede_firmar: checks.every((check) => check.ok),
    advertencia_48_horas: advertencia48Horas,
    horas_restantes: horasRestantes
  };
}

async function obtenerExpediente(ejecutor, id) {
  const [filas] = await ejecutor.execute(
    `SELECT d.id AS decreto_id, d.solicitud_id, d.numero,
            d.contenido, d.estado AS decreto_estado, d.firmante_id,
            d.firmado_at, d.hash_firma, d.observacion,
            s.folio, s.organizacion_id, s.dirigente_id, s.destino,
            s.fecha_salida, s.hora_salida, s.hora_regreso, s.motivo,
            s.estado AS solicitud_estado, s.bus_id,
            o.nombre AS organizacion_nombre, o.sector AS organizacion_sector,
            u.nombre AS dirigente_nombre, u.rut AS dirigente_rut,
            b.nombre AS bus_nombre, b.patente AS bus_patente,
            b.asientos AS bus_asientos, b.activo AS bus_activo,
            firma.nombre AS firmante_nombre,
            TIMESTAMPDIFF(
              MINUTE,
              NOW(),
              TIMESTAMP(s.fecha_salida, s.hora_salida)
            ) AS minutos_restantes
     FROM decretos d
     JOIN solicitudes s ON s.id = d.solicitud_id
     JOIN organizaciones o ON o.id = s.organizacion_id
     JOIN usuarios u ON u.id = s.dirigente_id
     LEFT JOIN buses b ON b.id = s.bus_id
     LEFT JOIN usuarios firma ON firma.id = d.firmante_id
     WHERE d.id = ?
     LIMIT 1`,
    [id]
  );
  if (filas.length === 0) {
    throw crearError(404, 'No encontramos ese decreto.');
  }

  const expediente = filas[0];
  const [pasajerosDB] = await ejecutor.execute(
    `SELECT id, nombre, rut
     FROM pasajeros
     WHERE solicitud_id = ?
     ORDER BY id`,
    [expediente.solicitud_id]
  );
  const pasajeros = obtenerPasajerosRevisados(pasajerosDB);
  let conflictos = [];

  if (expediente.bus_id && expediente.fecha_salida) {
    [conflictos] = await ejecutor.execute(
      `SELECT id, folio
       FROM solicitudes
       WHERE bus_id = ?
         AND fecha_salida = ?
         AND estado IN ('bus_asignado', 'decreto_firmado')
         AND id <> ?
       ORDER BY id`,
      [expediente.bus_id, expediente.fecha_salida, expediente.solicitud_id]
    );
  }

  return {
    expediente,
    pasajeros,
    contenido: leerContenido(expediente.contenido),
    revision: crearRevision(expediente, pasajeros, conflictos)
  };
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
        console.error('No fue posible revertir la transacción del decreto.', errorRollback);
      }
    }
    throw error;
  } finally {
    conexion.release();
  }
}

async function obtenerSolicitudBloqueada(conexion, solicitudId) {
  const [filas] = await conexion.execute(
    `SELECT id, folio, organizacion_id, dirigente_id, destino, fecha_salida,
            hora_salida, hora_regreso, motivo, estado, bus_id
     FROM solicitudes
     WHERE id = ?
     FOR UPDATE`,
    [solicitudId]
  );
  if (filas.length === 0) {
    throw crearError(404, 'No encontramos la solicitud asociada al decreto.');
  }
  return filas[0];
}

async function obtenerDecretoBloqueado(conexion, id) {
  const [filas] = await conexion.execute(
    `SELECT id, solicitud_id, numero, contenido, estado, observacion
     FROM decretos
     WHERE id = ?
     FOR UPDATE`,
    [id]
  );
  if (filas.length === 0) {
    throw crearError(404, 'No encontramos ese decreto.');
  }
  return filas[0];
}

async function obtenerAdministradorActivo(conexion, usuarioId) {
  const [filas] = await conexion.execute(
    `SELECT id, nombre
     FROM usuarios
     WHERE id = ?
       AND rol = 'administrador'
       AND activo = 1
     FOR UPDATE`,
    [usuarioId]
  );
  if (filas.length === 0) {
    throw crearError(403, 'La cuenta administradora ya no está habilitada para esta acción.');
  }
  return filas[0];
}

function validarComentario(valor) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw crearError(400, 'Escriba una observación para devolver el decreto.');
  }
  const comentario = valor.trim();
  if (comentario.length > 2000) {
    throw crearError(400, 'La observación no puede superar los 2.000 caracteres.');
  }
  return comentario;
}

function ordenarParaHash(valor) {
  if (Array.isArray(valor)) {
    return valor.map(ordenarParaHash);
  }
  if (!valor || typeof valor !== 'object') {
    return valor;
  }
  return Object.keys(valor).sort().reduce((ordenado, llave) => {
    ordenado[llave] = ordenarParaHash(valor[llave]);
    return ordenado;
  }, {});
}

function crearHashFirma(contenido, firmante, fecha) {
  const payload = JSON.stringify({
    contenido: ordenarParaHash(contenido),
    firmante,
    fecha
  });
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

async function emitirNumero(conexion, anio) {
  await conexion.execute(
    `INSERT INTO secuencias_decretos (anio, ultimo)
     SELECT ?, COUNT(*)
     FROM decretos
     WHERE estado = 'firmado'
       AND YEAR(firmado_at) = ?
     ON DUPLICATE KEY UPDATE anio = VALUES(anio)`,
    [anio, anio]
  );
  const [filas] = await conexion.execute(
    `SELECT ultimo
     FROM secuencias_decretos
     WHERE anio = ?
     FOR UPDATE`,
    [anio]
  );
  const siguiente = Number(filas[0].ultimo) + 1;
  await conexion.execute(
    'UPDATE secuencias_decretos SET ultimo = ? WHERE anio = ?',
    [siguiente, anio]
  );
  return `DCV N° ${siguiente}/${anio}`;
}

router.use(requireRole('administrador'));

router.get('/decretos', async (req, res, next) => {
  try {
    const estado = req.query.estado || 'pendiente';
    if (!estadosDecreto.has(estado)) {
      throw crearError(400, 'El estado solicitado no es válido.');
    }
    const [filas] = await pool.execute(
      `SELECT d.id AS decreto_id, d.numero, d.estado AS decreto_estado,
              d.observacion, s.id AS solicitud_id, s.folio, s.destino,
              s.fecha_salida, s.hora_salida, s.estado AS solicitud_estado,
              o.nombre AS organizacion_nombre, u.nombre AS dirigente_nombre,
              b.nombre AS bus_nombre, b.patente AS bus_patente,
              (SELECT COUNT(*) FROM pasajeros p WHERE p.solicitud_id = s.id)
                AS cantidad_pasajeros,
              TIMESTAMPDIFF(
                MINUTE,
                NOW(),
                TIMESTAMP(s.fecha_salida, s.hora_salida)
              ) AS minutos_restantes
       FROM decretos d
       JOIN solicitudes s ON s.id = d.solicitud_id
       JOIN organizaciones o ON o.id = s.organizacion_id
       JOIN usuarios u ON u.id = s.dirigente_id
       LEFT JOIN buses b ON b.id = s.bus_id
       WHERE d.estado = ?
       ORDER BY s.fecha_salida, d.id`,
      [estado]
    );
    return res.json({ ok: true, data: filas });
  } catch (error) {
    return next(error);
  }
});

router.get('/decretos/:id', async (req, res, next) => {
  try {
    const id = obtenerIdDecreto(req.params.id);
    const datos = await obtenerExpediente(pool, id);
    const { expediente, pasajeros, contenido, revision } = datos;
    const [historial] = await pool.execute(
      `SELECT h.estado_anterior, h.estado_nuevo, h.comentario, h.created_at,
              u.nombre AS usuario_nombre
       FROM historial_estados h
       LEFT JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.solicitud_id = ?
       ORDER BY h.created_at, h.id`,
      [expediente.solicitud_id]
    );

    return res.json({
      ok: true,
      data: {
        decreto: {
          id: expediente.decreto_id,
          numero: expediente.numero,
          estado: expediente.decreto_estado,
          firmante_id: expediente.firmante_id,
          firmante_nombre: expediente.firmante_nombre,
          firmado_at: expediente.firmado_at,
          hash_firma: expediente.hash_firma,
          observacion: expediente.observacion
        },
        solicitud: {
          id: expediente.solicitud_id,
          folio: expediente.folio,
          estado: expediente.solicitud_estado,
          destino: expediente.destino,
          fecha_salida: expediente.fecha_salida,
          hora_salida: expediente.hora_salida,
          hora_regreso: expediente.hora_regreso,
          motivo: expediente.motivo,
          organizacion: {
            nombre: expediente.organizacion_nombre,
            sector: expediente.organizacion_sector
          },
          dirigente: {
            nombre: expediente.dirigente_nombre,
            rut: expediente.dirigente_rut
          }
        },
        bus: expediente.bus_id
          ? {
            id: expediente.bus_id,
            nombre: expediente.bus_nombre,
            patente: expediente.bus_patente,
            asientos: expediente.bus_asientos,
            activo: Boolean(Number(expediente.bus_activo))
          }
          : null,
        pasajeros,
        contenido,
        revision,
        historial
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/decretos/:id/firmar', async (req, res, next) => {
  try {
    const id = obtenerIdDecreto(req.params.id);
    const resultado = await conTransaccion(async (conexion) => {
      const [referencias] = await conexion.execute(
        'SELECT solicitud_id FROM decretos WHERE id = ?',
        [id]
      );
      if (referencias.length === 0) {
        throw crearError(404, 'No encontramos ese decreto.');
      }

      const solicitud = await obtenerSolicitudBloqueada(conexion, referencias[0].solicitud_id);
      if (solicitud.estado !== 'bus_asignado' || !solicitud.bus_id) {
        throw crearError(409, 'El decreto solo se puede firmar si la solicitud tiene un bus asignado.');
      }

      const [buses] = await conexion.execute(
        `SELECT id, nombre, patente, asientos, activo
         FROM buses
         WHERE id = ?
         FOR UPDATE`,
        [solicitud.bus_id]
      );
      const [pasajerosDB] = await conexion.execute(
        `SELECT id, nombre, rut
         FROM pasajeros
         WHERE solicitud_id = ?
         ORDER BY id
         FOR UPDATE`,
        [solicitud.id]
      );
      const [conflictos] = await conexion.execute(
        `SELECT id, folio
         FROM solicitudes
         WHERE bus_id = ?
           AND fecha_salida = ?
           AND estado IN ('bus_asignado', 'decreto_firmado')
           AND id <> ?
         FOR UPDATE`,
        [solicitud.bus_id, solicitud.fecha_salida, solicitud.id]
      );
      const decreto = await obtenerDecretoBloqueado(conexion, id);
      if (decreto.estado !== 'pendiente') {
        throw crearError(409, 'Este decreto ya no está pendiente de firma.');
      }

      const pasajeros = obtenerPasajerosRevisados(pasajerosDB);
      const expediente = {
        ...solicitud,
        bus_id: buses.length ? buses[0].id : null,
        bus_nombre: buses.length ? buses[0].nombre : null,
        bus_patente: buses.length ? buses[0].patente : null,
        bus_asientos: buses.length ? buses[0].asientos : null,
        bus_activo: buses.length ? buses[0].activo : 0,
        minutos_restantes: null
      };
      const [horas] = await conexion.execute(
        `SELECT TIMESTAMPDIFF(
                  MINUTE,
                  NOW(),
                  TIMESTAMP(?, ?)
                ) AS minutos_restantes`,
        [solicitud.fecha_salida, solicitud.hora_salida]
      );
      expediente.minutos_restantes = horas[0].minutos_restantes;
      const revision = crearRevision(expediente, pasajeros, conflictos);
      if (!revision.puede_firmar) {
        const problemas = revision.checks
          .filter((check) => !check.ok)
          .map((check) => check.detalle)
          .join(' ');
        throw crearError(409, `No se puede firmar el decreto. ${problemas}`);
      }

      const firmante = await obtenerAdministradorActivo(conexion, req.usuario.id);

      const [instante] = await conexion.execute(
        `SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS firmado_at,
                YEAR(CURRENT_DATE()) AS anio`
      );
      const fechaFirma = instante[0].firmado_at;
      const anio = Number(instante[0].anio);
      const numero = await emitirNumero(conexion, anio);
      const contenido = leerContenido(decreto.contenido);
      const hash = crearHashFirma(contenido, firmante.nombre, fechaFirma);

      await conexion.execute(
        `UPDATE decretos
         SET numero = ?, estado = 'firmado', firmante_id = ?, firmado_at = ?,
             hash_firma = ?, observacion = NULL
         WHERE id = ?`,
        [numero, firmante.id, fechaFirma, hash, id]
      );
      await conexion.execute(
        `UPDATE solicitudes
         SET estado = 'decreto_firmado'
         WHERE id = ?`,
        [solicitud.id]
      );
      await conexion.execute(
        `INSERT INTO historial_estados
           (solicitud_id, estado_anterior, estado_nuevo, usuario_id, comentario)
         VALUES (?, 'bus_asignado', 'decreto_firmado', ?, ?)`,
        [solicitud.id, firmante.id, `Decreto ${numero} firmado. Firma de demostración.`]
      );
      await conexion.execute(
        `INSERT INTO notificaciones (usuario_id, solicitud_id, mensaje, canal)
         VALUES (?, ?, ?, 'app')`,
        [
          solicitud.dirigente_id,
          solicitud.id,
          `El decreto ${numero} de su solicitud ${solicitud.folio} fue firmado.`
        ]
      );

      return {
        id,
        solicitud_id: solicitud.id,
        folio: solicitud.folio,
        estado: 'firmado',
        numero,
        firmado_at: fechaFirma,
        firmante: firmante.nombre,
        hash_firma: hash,
        advertencia_48_horas: revision.advertencia_48_horas,
        horas_restantes: revision.horas_restantes
      };
    });

    return res.json({ ok: true, data: resultado });
  } catch (error) {
    return next(error);
  }
});

router.post('/decretos/:id/devolver', async (req, res, next) => {
  try {
    const id = obtenerIdDecreto(req.params.id);
    const observacion = validarComentario(req.body && req.body.observacion);
    const resultado = await conTransaccion(async (conexion) => {
      const [referencias] = await conexion.execute(
        'SELECT solicitud_id FROM decretos WHERE id = ?',
        [id]
      );
      if (referencias.length === 0) {
        throw crearError(404, 'No encontramos ese decreto.');
      }
      const solicitud = await obtenerSolicitudBloqueada(conexion, referencias[0].solicitud_id);
      const decreto = await obtenerDecretoBloqueado(conexion, id);
      if (decreto.estado !== 'pendiente' || solicitud.estado !== 'bus_asignado') {
        throw crearError(409, 'Solo puede devolver un decreto pendiente asociado a un bus asignado.');
      }
      const administrador = await obtenerAdministradorActivo(conexion, req.usuario.id);

      await conexion.execute(
        `UPDATE decretos
         SET estado = 'devuelto', observacion = ?
         WHERE id = ?`,
        [observacion, id]
      );
      await conexion.execute(
        `UPDATE solicitudes
         SET estado = 'en_revision', bus_id = NULL, observacion_dideco = ?
         WHERE id = ?`,
        [observacion, solicitud.id]
      );
      await conexion.execute(
        `INSERT INTO historial_estados
           (solicitud_id, estado_anterior, estado_nuevo, usuario_id, comentario)
         VALUES (?, 'bus_asignado', 'en_revision', ?, ?)`,
        [solicitud.id, administrador.id, observacion]
      );
      await conexion.execute(
        `INSERT INTO notificaciones
           (usuario_id, solicitud_id, mensaje, canal)
         SELECT id, ?, ?, 'app'
         FROM usuarios
         WHERE rol = 'dideco'
           AND activo = 1`,
        [
          solicitud.id,
          `Administración devolvió el decreto de la solicitud ${solicitud.folio}. Revise la observación registrada.`
        ]
      );

      return {
        id,
        solicitud_id: solicitud.id,
        folio: solicitud.folio,
        estado_decreto: 'devuelto',
        estado_solicitud: 'en_revision'
      };
    });
    return res.json({ ok: true, data: resultado });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
