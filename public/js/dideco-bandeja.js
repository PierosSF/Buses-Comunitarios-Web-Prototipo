'use strict';

function crearCelda(texto) {
  const celda = document.createElement('td');
  celda.textContent = texto || '—';
  return celda;
}

function crearFilaSolicitud(solicitud) {
  const fila = document.createElement('tr');
  const celdaFolio = document.createElement('td');
  const enlaceFolio = document.createElement('a');
  enlaceFolio.href = `/dideco/solicitud.html?id=${encodeURIComponent(solicitud.id)}`;
  enlaceFolio.textContent = solicitud.folio;
  celdaFolio.append(enlaceFolio);

  const organizacion = document.createElement('td');
  const nombreOrganizacion = document.createElement('strong');
  const dirigente = document.createElement('span');
  nombreOrganizacion.textContent = solicitud.organizacion_nombre;
  dirigente.textContent = solicitud.dirigente_nombre;
  dirigente.className = 'table-secondary-text';
  organizacion.append(nombreOrganizacion, document.createElement('br'), dirigente);

  const estado = document.createElement('span');
  estado.className = `state-badge state-${solicitud.estado}`;
  estado.textContent = window.SolicitudesUI.etiquetaEstado(solicitud.estado);
  const celdaEstado = document.createElement('td');
  celdaEstado.append(estado);

  const accion = document.createElement('td');
  const enlaceAccion = document.createElement('a');
  enlaceAccion.className = 'button-secondary';
  enlaceAccion.href = `/dideco/solicitud.html?id=${encodeURIComponent(solicitud.id)}`;
  enlaceAccion.textContent = solicitud.estado === 'enviada'
    ? 'Revisar'
    : 'Ver detalle';
  accion.append(enlaceAccion);

  fila.append(
    celdaFolio,
    organizacion,
    crearCelda(solicitud.destino),
    crearCelda(window.SolicitudesUI.formatearFecha(solicitud.fecha_salida)),
    crearCelda(String(solicitud.cantidad_pasajeros)),
    celdaEstado,
    crearCelda(solicitud.bus_nombre
      ? `${solicitud.bus_nombre} (${solicitud.bus_patente})`
      : 'Sin asignar'),
    accion
  );
  return fila;
}

async function cargarIndicadoresDideco() {
  const mensaje = document.querySelector('[data-indicator-message]');
  const respuesta = await window.apiFetch('/api/dideco/indicadores');

  if (!respuesta.ok) {
    mensaje.textContent = respuesta.error;
    mensaje.hidden = false;
    return;
  }

  Object.entries(respuesta.data).forEach(([nombre, valor]) => {
    const indicador = document.querySelector(`[data-indicator="${nombre}"]`);
    if (indicador) {
      indicador.textContent = String(valor);
    }
  });
  mensaje.hidden = true;
}

async function cargarSolicitudesDideco() {
  const mensaje = document.querySelector('[data-list-message]');
  const cuerpo = document.querySelector('[data-requests-body]');
  const estado = document.querySelector('[data-filter-state]').value;
  const buscar = document.querySelector('[data-filter-search]').value.trim();
  const parametros = new URLSearchParams();
  if (estado) {
    parametros.set('estado', estado);
  }
  if (buscar) {
    parametros.set('buscar', buscar);
  }
  const ruta = `/api/dideco/solicitudes${parametros.toString()
    ? `?${parametros.toString()}`
    : ''}`;
  mensaje.textContent = 'Cargando solicitudes...';
  mensaje.hidden = false;

  const respuesta = await window.apiFetch(ruta);
  if (!respuesta.ok) {
    mensaje.textContent = respuesta.error;
    mensaje.dataset.tipo = 'error';
    return;
  }

  cuerpo.replaceChildren();
  if (respuesta.data.length === 0) {
    mensaje.textContent = 'No hay solicitudes que coincidan con estos filtros.';
    delete mensaje.dataset.tipo;
    return;
  }

  respuesta.data.forEach((solicitud) => {
    cuerpo.append(crearFilaSolicitud(solicitud));
  });
  mensaje.hidden = true;
  delete mensaje.dataset.tipo;
}

function iniciarBandejaDideco() {
  document.querySelector('[data-filter-form]').addEventListener('submit', (evento) => {
    evento.preventDefault();
    cargarSolicitudesDideco();
  });
  cargarIndicadoresDideco();
  cargarSolicitudesDideco();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarBandejaDideco);
} else {
  iniciarBandejaDideco();
}
