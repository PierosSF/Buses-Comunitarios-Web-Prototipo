'use strict';

const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { limpiarRut, validarRut } = require('../utils/rut');

const router = express.Router();
const motivosPermitidos = new Set(['recreativa', 'deportiva', 'cultural', 'educativa']);

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

function textoOpcional(valor, nombreCampo, longitudMaxima) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }
  if (typeof valor !== 'string') {
    throw crearError(400, `El campo ${nombreCampo} no tiene un formato válido.`);
  }

  const texto = valor.trim();
  if (!texto) {
    return null;
  }
  if (texto.length > longitudMaxima) {
    throw crearError(400, `El campo ${nombreCampo} supera el largo permitido.`);
  }

  return texto;
}

function normalizarFecha(valor) {
  const fecha = textoOpcional(valor, 'fecha de salida', 10);
  if (!fecha) {
    return null;
  }

  const coincidencia = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!coincidencia) {
    throw crearError(400, 'Ingrese la fecha de salida en un formato válido.');
  }

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));

  if (
    fechaUtc.getUTCFullYear() !== anio
    || fechaUtc.getUTCMonth() !== mes - 1
    || fechaUtc.getUTCDate() !== dia
  ) {
    throw crearError(400, 'Ingrese una fecha de salida válida.');
  }

  return fecha;
}

function normalizarHora(valor, nombreCampo) {
  const hora = textoOpcional(valor, nombreCampo, 8);
  if (!hora) {
    return null;
  }

  const coincidencia = hora.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!coincidencia) {
    throw crearError(400, `Ingrese ${nombreCampo} en un formato válido.`);
  }

  return `${coincidencia[1]}:${coincidencia[2]}:${coincidencia[3] || '00'}`;
}

function normalizarDatosViaje(cuerpo) {
  const destino = textoOpcional(cuerpo.destino, 'destino', 200);
  const motivo = textoOpcional(cuerpo.motivo, 'motivo', 30);

  if (motivo && !motivosPermitidos.has(motivo)) {
    throw crearError(400, 'Seleccione un motivo de viaje válido.');
  }

  return {
    destino,
    fecha_salida: normalizarFecha(cuerpo.fecha_salida),
    hora_salida: normalizarHora(cuerpo.hora_salida, 'la hora de salida'),
    hora_regreso: normalizarHora(cuerpo.hora_regreso, 'la hora de regreso'),
    motivo
  };
}

function normalizarPasajeros(entrada, exigirCompletos) {
  if (entrada === undefined || entrada === null) {
    entrada = [];
  }
  if (!Array.isArray(entrada)) {
    throw crearError(400, 'La nómina de pasajeros no tiene un formato válido.');
  }
  if (entrada.length > 36) {
    throw crearError(400, 'Una solicitud puede incluir como máximo 36 pasajeros.');
  }

  const rutsVistos = new Set();
  const pasajeros = [];

  entrada.forEach((pasajero, indice) => {
    if (!pasajero || typeof pasajero !== 'object' || Array.isArray(pasajero)) {
      throw crearError(400, `Revise los datos del pasajero ${indice + 1}.`);
    }

    const nombre = textoOpcional(pasajero.nombre, `nombre del pasajero ${indice + 1}`, 150);
    const rutIngresado = textoOpcional(pasajero.rut, `RUT del pasajero ${indice + 1}`, 30);
    const rut = rutIngresado ? limpiarRut(rutIngresado) : null;

    if (rut && rut.length > 12) {
      throw crearError(400, `El RUT del pasajero ${indice + 1} supera el largo permitido.`);
    }

    if (!nombre && !rut) {
      return;
    }

    if (exigirCompletos && !nombre) {
      throw crearError(400, `Ingrese el nombre completo del pasajero ${indice + 1}.`);
    }
    if (exigirCompletos && !rut) {
      throw crearError(400, `Ingrese el RUT del pasajero ${indice + 1}.`);
    }
    if (rut && rutsVistos.has(rut)) {
      throw crearError(400, `El RUT del pasajero ${indice + 1} está repetido.`);
    }
    if (rut) {
      rutsVistos.add(rut);
    }
    if (exigirCompletos && !validarRut(rut)) {
      throw crearError(400, `El RUT del pasajero ${indice + 1} no es válido.`);
    }

    pasajeros.push({ nombre, rut });
  });

  return pasajeros;
}

function exigirDatosParaEnviar(solicitud, pasajeros) {
  if (!solicitud.destino) {
    throw crearError(400, 'Ingrese el destino del viaje antes de enviar la solicitud.');
  }
  if (!solicitud.fecha_salida || !solicitud.hora_salida || !solicitud.hora_regreso) {
    throw crearError(400, 'Complete la fecha y las horas de salida y regreso.');
  }
  if (!solicitud.motivo) {
    throw crearError(400, 'Seleccione el motivo del viaje.');
  }
  if (pasajeros.length < 1 || pasajeros.length > 36) {
    throw crearError(400, 'La nómina debe tener entre 1 y 36 pasajeros.');
  }
}

async function conTransaccion(operacion) {
  const conexion = await pool.getConnection();
  let transaccionIniciada = false;

  try {
    await conexion.beginTransaction();
    transaccionIniciada = true;
    const resultado = await operacion(conexion);
    await conexion.commit();
    transaccionIniciada = false;
    return resultado;
  } catch (error) {
    if (transaccionIniciada) {
      try {
        await conexion.rollback();
      } catch (errorRollback) {
        console.error('No fue posible revertir la transacción de solicitud.', errorRollback);
      }
    }
    throw error;
  } finally {
    conexion.release();
  }
}

async function generarFolio(conexion) {
  const [filasAnio] = await conexion.query('SELECT YEAR(CURDATE()) AS anio');
  const anio = Number(filasAnio[0].anio);
  const prefijo = `${anio}-%`;

  await conexion.execute(
    `INSERT IGNORE INTO secuencias_folios (anio, ultimo)
     SELECT ?, COALESCE(MAX(CAST(SUBSTRING_INDEX(folio, '-', -1) AS UNSIGNED)), 0)
     FROM solicitudes
     WHERE folio LIKE ?`,
    [anio, prefijo]
  );

  const [filasSecuencia] = await conexion.execute(
    'SELECT ultimo FROM secuencias_folios WHERE anio = ? FOR UPDATE',
    [anio]
  );
  const siguiente = Number(filasSecuencia[0].ultimo) + 1;

  if (siguiente > 9999) {
    throw crearError(409, 'No hay más folios disponibles para este año.');
  }

  await conexion.execute(
    'UPDATE secuencias_folios SET ultimo = ? WHERE anio = ?',
    [siguiente, anio]
  );

  return `${anio}-${String(siguiente).padStart(4, '0')}`;
}

async function insertarPasajeros(conexion, solicitudId, pasajeros) {
  for (const pasajero of pasajeros) {
    await conexion.execute(
      'INSERT INTO pasajeros (solicitud_id, nombre, rut) VALUES (?, ?, ?)',
      [solicitudId, pasajero.nombre, pasajero.rut]
    );
  }
}

router.use(requireRole('dirigente'), (req, res, next) => {
  if (!req.usuario.organizacion_id) {
    return res.status(403).json({
      ok: false,
      error: 'Su cuenta no tiene una organización asignada.'
    });
  }
  return next();
});

router.get('/', async (req, res, next) => {
  try {
    const [filas] = await pool.execute(
      `SELECT
         s.id, s.folio, s.destino, s.fecha_salida, s.estado, s.created_at,
         b.id AS bus_id, b.nombre AS bus_nombre, b.patente AS bus_patente,
         d.estado AS decreto_estado
       FROM solicitudes s
       LEFT JOIN buses b ON b.id = s.bus_id
       LEFT JOIN decretos d ON d.solicitud_id = s.id
       WHERE s.organizacion_id = ?
       ORDER BY s.created_at DESC, s.id DESC`,
      [req.usuario.organizacion_id]
    );

    const solicitudes = filas.map((fila) => ({
      id: fila.id,
      folio: fila.folio,
      destino: fila.destino,
      fecha_salida: fila.fecha_salida,
      estado: fila.estado,
      created_at: fila.created_at,
      bus: fila.bus_id
        ? { id: fila.bus_id, nombre: fila.bus_nombre, patente: fila.bus_patente }
        : null,
      decreto_estado: fila.decreto_estado
    }));

    return res.json({ ok: true, data: solicitudes });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const cuerpo = req.body || {};
    const viaje = normalizarDatosViaje(cuerpo);
    const pasajeros = normalizarPasajeros(cuerpo.pasajeros, false);
    const solicitud = await conTransaccion(async (conexion) => {
      const folio = await generarFolio(conexion);
      const [resultado] = await conexion.execute(
        `INSERT INTO solicitudes
           (folio, organizacion_id, dirigente_id, destino, fecha_salida,
            hora_salida, hora_regreso, motivo, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'borrador')`,
        [
          folio,
          req.usuario.organizacion_id,
          req.usuario.id,
          viaje.destino,
          viaje.fecha_salida,
          viaje.hora_salida,
          viaje.hora_regreso,
          viaje.motivo
        ]
      );

      await insertarPasajeros(conexion, resultado.insertId, pasajeros);
      return { id: resultado.insertId, folio, estado: 'borrador' };
    });

    return res.status(201).json({ ok: true, data: solicitud });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = obtenerIdSolicitud(req.params.id);
    const cuerpo = req.body || {};
    const viaje = normalizarDatosViaje(cuerpo);
    const pasajeros = normalizarPasajeros(cuerpo.pasajeros, false);
    const solicitud = await conTransaccion(async (conexion) => {
      const [filas] = await conexion.execute(
        `SELECT folio, estado
         FROM solicitudes
         WHERE id = ? AND organizacion_id = ?
         FOR UPDATE`,
        [id, req.usuario.organizacion_id]
      );

      if (filas.length === 0) {
        throw crearError(404, 'No encontramos esa solicitud en su organización.');
      }
      if (filas[0].estado !== 'borrador') {
        throw crearError(409, 'Solo puede editar solicitudes que aún están en borrador.');
      }

      await conexion.execute(
        `UPDATE solicitudes
         SET destino = ?, fecha_salida = ?, hora_salida = ?, hora_regreso = ?, motivo = ?
         WHERE id = ? AND organizacion_id = ?`,
        [
          viaje.destino,
          viaje.fecha_salida,
          viaje.hora_salida,
          viaje.hora_regreso,
          viaje.motivo,
          id,
          req.usuario.organizacion_id
        ]
      );
      await conexion.execute('DELETE FROM pasajeros WHERE solicitud_id = ?', [id]);
      await insertarPasajeros(conexion, id, pasajeros);

      return { id, folio: filas[0].folio, estado: 'borrador' };
    });

    return res.json({ ok: true, data: solicitud });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/enviar', async (req, res, next) => {
  try {
    const id = obtenerIdSolicitud(req.params.id);
    const resultado = await conTransaccion(async (conexion) => {
      const [filas] = await conexion.execute(
        `SELECT id, folio, destino, fecha_salida, hora_salida, hora_regreso, motivo, estado
         FROM solicitudes
         WHERE id = ? AND organizacion_id = ?
         FOR UPDATE`,
        [id, req.usuario.organizacion_id]
      );

      if (filas.length === 0) {
        throw crearError(404, 'No encontramos esa solicitud en su organización.');
      }
      if (filas[0].estado !== 'borrador') {
        throw crearError(409, 'Solo puede enviar una solicitud que aún está en borrador.');
      }

      const [filasPasajeros] = await conexion.execute(
        'SELECT nombre, rut FROM pasajeros WHERE solicitud_id = ? ORDER BY id',
        [id]
      );
      const pasajeros = normalizarPasajeros(filasPasajeros, true);
      exigirDatosParaEnviar(filas[0], pasajeros);

      const [filasFecha] = await conexion.execute(
        'SELECT CAST(? AS DATE) > CURDATE() AS es_futura',
        [filas[0].fecha_salida]
      );
      if (Number(filasFecha[0].es_futura) !== 1) {
        throw crearError(400, 'La fecha de salida debe ser posterior a hoy.');
      }

      await conexion.execute(
        `UPDATE solicitudes
         SET estado = 'enviada'
         WHERE id = ? AND organizacion_id = ? AND estado = 'borrador'`,
        [id, req.usuario.organizacion_id]
      );
      await conexion.execute(
        `INSERT INTO historial_estados
           (solicitud_id, estado_anterior, estado_nuevo, usuario_id, comentario)
         VALUES (?, 'borrador', 'enviada', ?, ?)`,
        [id, req.usuario.id, 'Solicitud enviada por la organización.']
      );

      const [funcionarios] = await conexion.execute(
        `SELECT id
         FROM usuarios
         WHERE rol = 'dideco' AND activo = 1`
      );
      for (const funcionario of funcionarios) {
        await conexion.execute(
          `INSERT INTO notificaciones (usuario_id, solicitud_id, mensaje, canal)
           VALUES (?, ?, ?, 'app')`,
          [
            funcionario.id,
            id,
            `La solicitud ${filas[0].folio} fue enviada y está pendiente de revisión.`
          ]
        );
      }

      return { id, folio: filas[0].folio, estado: 'enviada' };
    });

    return res.json({ ok: true, data: resultado });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = obtenerIdSolicitud(req.params.id);
    const [filasSolicitud] = await pool.execute(
      `SELECT
         s.id, s.folio, s.organizacion_id, s.dirigente_id, s.destino,
         s.fecha_salida, s.hora_salida, s.hora_regreso, s.motivo, s.estado,
         s.observacion_dideco, s.created_at, s.updated_at,
         b.id AS bus_id, b.nombre AS bus_nombre, b.patente AS bus_patente,
         b.asientos AS bus_asientos
       FROM solicitudes s
       LEFT JOIN buses b ON b.id = s.bus_id
       WHERE s.id = ? AND s.organizacion_id = ?
       LIMIT 1`,
      [id, req.usuario.organizacion_id]
    );

    if (filasSolicitud.length === 0) {
      throw crearError(404, 'No encontramos esa solicitud en su organización.');
    }

    const solicitud = filasSolicitud[0];
    const [pasajeros] = await pool.execute(
      'SELECT id, nombre, rut FROM pasajeros WHERE solicitud_id = ? ORDER BY id',
      [id]
    );
    const [historial] = await pool.execute(
      `SELECT h.estado_anterior, h.estado_nuevo, h.comentario, h.created_at,
              u.nombre AS usuario_nombre
       FROM historial_estados h
       LEFT JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.solicitud_id = ?
       ORDER BY h.created_at, h.id`,
      [id]
    );
    const [decretos] = await pool.execute(
      `SELECT id, numero, contenido, estado, firmado_at, observacion
       FROM decretos
       WHERE solicitud_id = ?
       LIMIT 1`,
      [id]
    );

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
          updated_at: solicitud.updated_at
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
        decreto: decretos[0] || null
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
