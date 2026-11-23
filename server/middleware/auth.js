'use strict';

function requireAuth(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({
      ok: false,
      error: 'Debe iniciar sesión para continuar.'
    });
  }

  req.usuario = req.session.usuario;
  return next();
}

function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.session || !req.session.usuario) {
      return res.status(401).json({
        ok: false,
        error: 'Debe iniciar sesión para continuar.'
      });
    }

    req.usuario = req.session.usuario;

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        ok: false,
        error: 'No tiene permiso para acceder a este recurso.'
      });
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
