'use strict';

const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const [filas] = await pool.execute(
      `SELECT n.id, n.solicitud_id, n.mensaje, n.leida, n.created_at,
              d.id AS decreto_id
       FROM notificaciones n
       LEFT JOIN decretos d ON d.solicitud_id = n.solicitud_id
       WHERE n.usuario_id = ?
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT 20`,
      [req.usuario.id]
    );
    const [[conteo]] = await pool.execute(
      `SELECT COUNT(*) AS sin_leer
       FROM notificaciones
       WHERE usuario_id = ? AND leida = 0`,
      [req.usuario.id]
    );

    return res.json({
      ok: true,
      data: {
        sin_leer: Number(conteo.sin_leer),
        notificaciones: filas
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/leida', async (req, res, next) => {
  try {
    if (!/^[1-9]\d*$/.test(req.params.id)) {
      return res.status(400).json({
        ok: false,
        error: 'El número de notificación no es válido.'
      });
    }

    const id = Number(req.params.id);
    const [resultado] = await pool.execute(
      `UPDATE notificaciones
       SET leida = 1
       WHERE id = ? AND usuario_id = ?`,
      [id, req.usuario.id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        error: 'No encontramos esa notificación.'
      });
    }

    return res.json({ ok: true, data: { id, leida: true } });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
