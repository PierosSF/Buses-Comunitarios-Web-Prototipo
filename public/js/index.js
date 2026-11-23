'use strict';

async function redirigirAlInicioDelRol() {
  const mensaje = document.querySelector('[data-home-message]');
  const respuesta = await window.apiFetch('/api/auth/me');

  if (!respuesta.ok) {
    mensaje.textContent = respuesta.status === 401
      ? 'Su sesión no está iniciada. Le estamos llevando al acceso.'
      : respuesta.error;
    return;
  }

  const usuario = respuesta.data;
  const rutasPorRol = {
    dirigente: '/dirigente/solicitudes.html',
    dideco: '/dideco/bandeja.html',
    administrador: '/admin/decretos.html'
  };
  const destino = rutasPorRol[usuario.rol];

  if (!destino) {
    mensaje.textContent = 'No se pudo reconocer el perfil de su cuenta. Comuníquese con la Municipalidad.';
    return;
  }

  window.plcUsuarioActual = usuario;
  document.dispatchEvent(new CustomEvent('plc:sesion-iniciada', { detail: usuario }));
  window.location.replace(destino);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', redirigirAlInicioDelRol);
} else {
  redirigirAlInicioDelRol();
}
