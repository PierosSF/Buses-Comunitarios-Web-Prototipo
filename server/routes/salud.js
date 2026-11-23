const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/salud', async (req, res, next) => {
  try {
    const [filas] = await pool.query('SELECT 1 AS conectado');
    res.json({
      ok: true,
      data: {
        servidor: 'disponible',
        baseDeDatos: filas[0].conectado === 1 ? 'disponible' : 'no disponible'
      }
    });
  } catch (error) {
    error.status = 503;
    error.publicMessage = 'No fue posible conectar con la base de datos. Verifique que MySQL esté iniciado y que .env tenga los datos correctos.';
    next(error);
  }
});

module.exports = router;
