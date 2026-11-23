'use strict';

const rutasPorRol = {
  dirigente: '/dirigente/solicitudes.html',
  dideco: '/dideco/bandeja.html',
  administrador: '/admin/decretos.html'
};

async function verificarAccesoDePagina() {
  const rolRequerido = document.body.dataset.requiredRole;

  if (!rolRequerido) {
    return;
  }

  const contenido = document.querySelector('main');
  const estado = document.createElement('p');
  estado.setAttribute('role', 'status');
  estado.textContent = 'Verificando su sesión...';
  contenido.before(estado);
  document.documentElement.classList.add('auth-pending');

  const respuesta = await window.apiFetch('/api/auth/me');

  if (!respuesta.ok) {
    estado.textContent = respuesta.status === 401
      ? 'Su sesión terminó. Le estamos llevando al inicio de sesión.'
      : respuesta.error;
    return;
  }

  const usuario = respuesta.data;
  window.plcUsuarioActual = usuario;
  document.dispatchEvent(new CustomEvent('plc:sesion-iniciada', { detail: usuario }));

  if (!Object.prototype.hasOwnProperty.call(rutasPorRol, usuario.rol)) {
    estado.textContent = 'No se pudo reconocer el perfil de su cuenta. Comuníquese con la Municipalidad.';
    return;
  }

  if (usuario.rol !== rolRequerido) {
    window.location.replace(rutasPorRol[usuario.rol]);
    return;
  }

  document.documentElement.classList.remove('auth-pending');
  estado.remove();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', verificarAccesoDePagina);
} else {
  verificarAccesoDePagina();
}
