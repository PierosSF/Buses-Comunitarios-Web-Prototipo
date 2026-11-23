'use strict';

const etiquetasMotivoSolicitud = {
  recreativa: 'Recreativa para adultos mayores',
  deportiva: 'Deportiva',
  cultural: 'Cultural',
  educativa: 'Educativa'
};

function crearDatoDetalle(etiqueta, valor) {
  const fila = document.createElement('div');
  const nombre = document.createElement('dt');
  const dato = document.createElement('dd');
  nombre.textContent = etiqueta;
  dato.textContent = valor || 'Pendiente de completar';
  fila.append(nombre, dato);
  return fila;
}

function agregarPasajeroATabla(tbody, pasajero) {
  const fila = document.createElement('tr');
  const nombre = document.createElement('td');
  const rut = document.createElement('td');
  nombre.textContent = pasajero.nombre || 'Nombre pendiente';
  rut.textContent = pasajero.rut ? window.Rut.formatearRut(pasajero.rut) : 'RUT pendiente';
  fila.append(nombre, rut);
  tbody.append(fila);
}

function formatearFechaHoraHistorial(valor) {
  if (!valor) {
    return 'Fecha pendiente';
  }

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    return String(valor);
  }

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(fecha);
}

function mostrarHistorial(historial) {
  const lista = document.querySelector('[data-request-history]');
  lista.replaceChildren();

  if (historial.length === 0) {
    const vacio = document.createElement('li');
    vacio.textContent = 'Aún no hay cambios de estado registrados.';
    lista.append(vacio);
    return;
  }

  historial.forEach((evento) => {
    const elemento = document.createElement('li');
    const titulo = document.createElement('strong');
    const fecha = document.createElement('time');
    const detalle = document.createElement('p');
    const anterior = evento.estado_anterior
      ? window.SolicitudesUI.etiquetaEstado(evento.estado_anterior)
      : 'Solicitud creada';
    const nuevo = window.SolicitudesUI.etiquetaEstado(evento.estado_nuevo);

    titulo.textContent = `${anterior} → ${nuevo}`;
    fecha.dateTime = evento.created_at || '';
    fecha.textContent = formatearFechaHoraHistorial(evento.created_at);
    detalle.textContent = [
      evento.comentario || '',
      evento.usuario_nombre ? `Responsable: ${evento.usuario_nombre}` : ''
    ].filter(Boolean).join(' ');

    elemento.append(titulo, fecha);
    if (detalle.textContent) {
      elemento.append(detalle);
    }
    lista.append(elemento);
  });
}

function obtenerContenidoDecreto(contenido) {
  if (contenido && typeof contenido === 'object') {
    return contenido;
  }
  if (typeof contenido === 'string') {
    try {
      return JSON.parse(contenido);
    } catch (error) {
      console.error('El contenido del decreto no tiene formato JSON válido.', error);
    }
  }
  return {};
}

function renderizarDecreto(decreto, solicitud, pasajeros) {
  const seccion = document.querySelector('[data-decree-section]');
  const pendiente = document.querySelector('[data-decree-pending]');
  const documento = document.querySelector('[data-print-document]');

  if (!decreto || decreto.estado !== 'firmado') {
    pendiente.hidden = false;
    pendiente.textContent = decreto
      ? 'El decreto aún no está firmado. Podrá imprimirlo cuando esté listo.'
      : 'Esta solicitud todavía no tiene un decreto asociado.';
    return;
  }

  seccion.hidden = false;
  document.querySelector('[data-decree-number]').textContent =
    decreto.numero || 'Número pendiente';
  document.querySelector('[data-decree-folio]').textContent = solicitud.folio;
  document.querySelector('[data-decree-sign-date]').textContent =
    formatearFechaHoraHistorial(decreto.firmado_at);
  document.querySelector('[data-decree-observation]').textContent =
    decreto.observacion || 'Sin observaciones.';

  const contenido = obtenerContenidoDecreto(decreto.contenido);
  const datosDecreto = document.querySelector('[data-decree-content]');
  datosDecreto.replaceChildren(
    crearDatoDetalle('Folio', contenido.folio || solicitud.folio),
    crearDatoDetalle('Destino', contenido.destino || solicitud.destino),
    crearDatoDetalle(
      'Fecha de salida',
      window.SolicitudesUI.formatearFecha(contenido.fecha_salida || solicitud.fecha_salida)
    )
  );

  const listaPasajeros = document.querySelector('[data-decree-passengers]');
  listaPasajeros.replaceChildren();
  pasajeros.forEach((pasajero) => {
    const elemento = document.createElement('li');
    elemento.textContent = `${pasajero.nombre || 'Nombre pendiente'} — ${
      pasajero.rut ? window.Rut.formatearRut(pasajero.rut) : 'RUT pendiente'
    }`;
    listaPasajeros.append(elemento);
  });

  document.querySelector('[data-print-decree]').addEventListener('click', () => {
    document.body.classList.add('printing-decree');
    window.print();
  });
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-decree');
  }, { once: true });

  documento.hidden = false;
}

async function cargarDetalleSolicitud() {
  const mensaje = document.querySelector('[data-detail-message]');
  const id = new URLSearchParams(window.location.search).get('id');

  if (!id || !/^[1-9]\d*$/.test(id)) {
    mensaje.textContent = 'El enlace no incluye un número de solicitud válido.';
    return;
  }

  const respuesta = await window.apiFetch(`/api/solicitudes/${encodeURIComponent(id)}`);
  if (!respuesta.ok) {
    mensaje.textContent = respuesta.error;
    return;
  }

  const datos = respuesta.data;
  const solicitud = datos.solicitud;
  const pasajeros = datos.pasajeros || [];
  document.querySelector('[data-detail-title]').textContent = `Solicitud ${solicitud.folio}`;

  const estado = document.querySelector('[data-detail-state]');
  estado.textContent = window.SolicitudesUI.etiquetaEstado(solicitud.estado);
  estado.className = `state-badge state-${solicitud.estado}`;

  document.querySelector('[data-detail-progress]').replaceChildren(
    window.SolicitudesUI.crearProgreso(solicitud.estado)
  );

  const resumen = document.querySelector('[data-request-data]');
  resumen.replaceChildren(
    crearDatoDetalle('Destino', solicitud.destino),
    crearDatoDetalle('Fecha de salida', window.SolicitudesUI.formatearFecha(solicitud.fecha_salida)),
    crearDatoDetalle('Hora de salida', window.SolicitudesUI.formatearHora(solicitud.hora_salida)),
    crearDatoDetalle('Hora de regreso', window.SolicitudesUI.formatearHora(solicitud.hora_regreso)),
    crearDatoDetalle(
      'Motivo',
      etiquetasMotivoSolicitud[solicitud.motivo] || solicitud.motivo
    ),
    crearDatoDetalle(
      'Bus asignado',
      datos.bus ? `${datos.bus.nombre} (${datos.bus.patente})` : 'Pendiente de asignación'
    )
  );

  const observacion = document.querySelector('[data-dideco-observation]');
  if (solicitud.observacion_dideco) {
    observacion.textContent = solicitud.observacion_dideco;
    observacion.hidden = false;
  }

  const tablaPasajeros = document.querySelector('[data-detail-passengers]');
  tablaPasajeros.replaceChildren();
  pasajeros.forEach((pasajero) => agregarPasajeroATabla(tablaPasajeros, pasajero));
  document.querySelector('[data-passenger-empty]').hidden = pasajeros.length > 0;
  mostrarHistorial(datos.historial || []);
  renderizarDecreto(datos.decreto, solicitud, pasajeros);
  mensaje.hidden = true;
  document.querySelector('[data-request-detail]').hidden = false;
  if (window.location.hash === '#decreto' && !document.querySelector('[data-decree-section]').hidden) {
    document.querySelector('[data-decree-section]').scrollIntoView({ block: 'start' });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', cargarDetalleSolicitud);
} else {
  cargarDetalleSolicitud();
}
