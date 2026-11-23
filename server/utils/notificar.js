'use strict';

const pool = require('../db');

async function notificar(usuarioId, solicitudId, mensaje) {
  await pool.execute(
    `INSERT INTO notificaciones
       (usuario_id, solicitud_id, mensaje, canal, leida)
     VALUES (?, ?, ?, 'app', 0)`,
    [usuarioId, solicitudId, mensaje]
  );

  const [usuarios] = await pool.execute(
    'SELECT email FROM usuarios WHERE id = ? LIMIT 1',
    [usuarioId]
  );
  const correo = usuarios[0] ? usuarios[0].email : 'correo no registrado';
  console.log(`[correo simulado] Para ${correo}: ${mensaje}`);
}

module.exports = { notificar };
