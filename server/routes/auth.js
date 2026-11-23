'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { limpiarRut, validarRut } = require('../utils/rut');

const router = express.Router();
const mensajeLoginFallido = 'El RUT o la clave no son correctos.';
const hashDeComparacion = '$2a$10$wny7m8bNsIXSZjkZ9oHGOutrYq.UZ6skjqkc5J0kW6XEmntnMIMHu';

function ejecutarOperacionSesion(sesion, operacion) {
  return new Promise((resolve, reject) => {
    sesion[operacion]((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

router.post('/login', async (req, res, next) => {
  try {
    const cuerpo = req.body || {};
    const rut = limpiarRut(cuerpo.rut);
    const clave = typeof cuerpo.clave === 'string' ? cuerpo.clave : '';
    const claveValida = clave.length > 0 && Buffer.byteLength(clave, 'utf8') <= 72;

    if (!claveValida || !validarRut(rut)) {
      await bcrypt.compare(claveValida ? clave : '', hashDeComparacion);
      return res.status(401).json({ ok: false, error: mensajeLoginFallido });
    }

    const [filas] = await pool.execute(
      `SELECT id, nombre, password_hash, rol, organizacion_id
       FROM usuarios
       WHERE rut = ? AND activo = 1
       LIMIT 1`,
      [rut]
    );
    const usuario = filas[0];
    const claveCorrecta = await bcrypt.compare(
      clave,
      usuario ? usuario.password_hash : hashDeComparacion
    );

    if (!usuario || !claveCorrecta) {
      return res.status(401).json({ ok: false, error: mensajeLoginFallido });
    }

    const datosSesion = {
      id: usuario.id,
      rol: usuario.rol,
      nombre: usuario.nombre,
      organizacion_id: usuario.organizacion_id
    };

    await ejecutarOperacionSesion(req.session, 'regenerate');
    req.session.usuario = datosSesion;
    await ejecutarOperacionSesion(req.session, 'save');

    return res.json({ ok: true, data: datosSesion });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    res.json({
      ok: true,
      data: { mensaje: 'Sesión cerrada correctamente.' }
    });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({
      ok: false,
      error: 'Debe iniciar sesión para continuar.'
    });
  }

  return res.json({ ok: true, data: req.session.usuario });
});

module.exports = router;
