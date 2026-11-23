'use strict';

const pasosSolicitud = [
  'Enviada',
  'Nómina validada',
  'Revisión DIDECO',
  'Bus asignado',
  'Decreto firmado'
];

const progresoSolicitud = {
  borrador: -1,
  enviada: 0,
  devuelta: 0,
  en_revision: 2,
  bus_asignado: 3,
  decreto_firmado: 4,
  rechazada: 2
};

const etiquetasEstadoSolicitud = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  devuelta: 'Devuelta para corregir',
  en_revision: 'En revisión DIDECO',
  bus_asignado: 'Bus asignado',
  decreto_firmado: 'Decreto firmado',
  rechazada: 'Rechazada'
};

function crearProgresoSolicitud(estado) {
  const actual = Object.prototype.hasOwnProperty.call(progresoSolicitud, estado)
    ? progresoSolicitud[estado]
    : -1;
  const progreso = document.createElement('ol');
  progreso.className = 'request-progress';
  progreso.setAttribute('aria-label', 'Avance de la solicitud');

  pasosSolicitud.forEach((nombre, indice) => {
    const paso = document.createElement('li');
    const numero = document.createElement('span');
    const etiqueta = document.createElement('span');
    paso.className = 'request-progress-step';
    numero.className = 'request-progress-number';
    numero.textContent = String(indice + 1);
    etiqueta.textContent = nombre;
    paso.append(numero, etiqueta);

    if (indice < actual) {
      paso.classList.add('is-complete');
    } else if (indice === actual) {
      paso.classList.add(
        estado === 'rechazada'
          ? 'is-rejected'
          : estado === 'devuelta'
            ? 'is-returned'
            : 'is-current'
      );
      paso.setAttribute('aria-current', 'step');
    }

    progreso.append(paso);
  });

  return progreso;
}

function formatearFechaSolicitud(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    return 'Fecha pendiente';
  }

  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}-${mes}-${anio}`;
}

function formatearHoraSolicitud(hora) {
  return typeof hora === 'string' && hora.length >= 5
    ? hora.slice(0, 5)
    : 'No indicada';
}

function etiquetaEstadoSolicitud(estado) {
  return etiquetasEstadoSolicitud[estado] || 'Estado desconocido';
}

function crearLineaTiempo(selector, historial) {
  const lista = typeof selector === 'string'
    ? document.querySelector(selector)
    : selector;
  if (!lista) {
    return;
  }

  lista.replaceChildren();
  if (!Array.isArray(historial) || historial.length === 0) {
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
      ? etiquetaEstadoSolicitud(evento.estado_anterior)
      : 'Solicitud creada';

    titulo.textContent = `${anterior} → ${etiquetaEstadoSolicitud(evento.estado_nuevo)}`;
    fecha.dateTime = evento.created_at || '';
    const fechaValor = new Date(evento.created_at);
    fecha.textContent = Number.isNaN(fechaValor.getTime())
      ? 'Fecha pendiente'
      : new Intl.DateTimeFormat('es-CL', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(fechaValor);
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

window.SolicitudesUI = Object.freeze({
  crearProgreso: crearProgresoSolicitud,
  formatearFecha: formatearFechaSolicitud,
  formatearHora: formatearHoraSolicitud,
  etiquetaEstado: etiquetaEstadoSolicitud,
  crearLineaTiempo
});
