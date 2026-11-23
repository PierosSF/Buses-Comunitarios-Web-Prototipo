'use strict';

function crearEnlaceSolicitud(href, texto, clase) {
  const enlace = document.createElement('a');
  enlace.href = href;
  enlace.className = clase;
  enlace.textContent = texto;
  return enlace;
}

function crearTarjetaSolicitud(solicitud) {
  const tarjeta = document.createElement('article');
  const titulo = document.createElement('h2');
  const tituloEnlace = crearEnlaceSolicitud(
    `/dirigente/solicitud.html?id=${encodeURIComponent(solicitud.id)}`,
    `Solicitud ${solicitud.folio}`,
    'request-title-link'
  );
  const datos = document.createElement('dl');
  const destino = document.createElement('div');
  const fecha = document.createElement('div');
  const estado = document.createElement('span');
  const acciones = document.createElement('div');
  const tarjetaEstado = document.createElement('dt');
  const valorEstado = document.createElement('dd');

  tarjeta.className = 'request-card';
  titulo.append(tituloEnlace);
  titulo.className = 'request-card-title';
  estado.className = `state-badge state-${solicitud.estado}`;
  estado.textContent = window.SolicitudesUI.etiquetaEstado(solicitud.estado);

  tarjetaEstado.textContent = 'Estado';
  valorEstado.append(estado);
  const filaEstado = document.createElement('div');
  filaEstado.append(tarjetaEstado, valorEstado);

  const destinoEtiqueta = document.createElement('dt');
  const destinoValor = document.createElement('dd');
  destinoEtiqueta.textContent = 'Destino';
  destinoValor.textContent = solicitud.destino || 'Pendiente de completar';
  destino.append(destinoEtiqueta, destinoValor);

  const fechaEtiqueta = document.createElement('dt');
  const fechaValor = document.createElement('dd');
  fechaEtiqueta.textContent = 'Fecha de salida';
  fechaValor.textContent = window.SolicitudesUI.formatearFecha(solicitud.fecha_salida);
  fecha.append(fechaEtiqueta, fechaValor);

  datos.className = 'request-card-data';
  datos.append(filaEstado, destino, fecha);

  if (solicitud.bus) {
    const filaBus = document.createElement('div');
    const busEtiqueta = document.createElement('dt');
    const busValor = document.createElement('dd');
    busEtiqueta.textContent = 'Bus asignado';
    busValor.textContent = `${solicitud.bus.nombre} (${solicitud.bus.patente})`;
    filaBus.append(busEtiqueta, busValor);
    datos.append(filaBus);
  }

  tarjeta.append(titulo, datos, window.SolicitudesUI.crearProgreso(solicitud.estado));
  acciones.className = 'request-card-actions';

  if (solicitud.estado === 'borrador' || solicitud.estado === 'devuelta') {
    acciones.append(crearEnlaceSolicitud(
      `/dirigente/nueva-solicitud.html?id=${encodeURIComponent(solicitud.id)}`,
      solicitud.estado === 'devuelta' ? 'Corregir solicitud' : 'Continuar borrador',
      'button-secondary'
    ));
  } else {
    acciones.append(crearEnlaceSolicitud(
      `/dirigente/solicitud.html?id=${encodeURIComponent(solicitud.id)}`,
      'Ver solicitud',
      'button-secondary'
    ));
  }

  if (solicitud.decreto_estado === 'firmado') {
    acciones.append(crearEnlaceSolicitud(
      `/dirigente/solicitud.html?id=${encodeURIComponent(solicitud.id)}#decreto`,
      'Descargar autorización',
      'button-primary'
    ));
  }

  tarjeta.append(acciones);
  return tarjeta;
}

async function cargarSolicitudesDirigente() {
  const estadoCarga = document.querySelector('[data-list-message]');
  const lista = document.querySelector('[data-request-list]');
  const respuesta = await window.apiFetch('/api/solicitudes');

  if (!respuesta.ok) {
    estadoCarga.textContent = respuesta.error;
    estadoCarga.dataset.tipo = 'error';
    return;
  }

  lista.replaceChildren();

  if (respuesta.data.length === 0) {
    estadoCarga.textContent = 'Aún no hay solicitudes. Puede crear una nueva cuando lo necesite.';
    estadoCarga.hidden = false;
    return;
  }

  estadoCarga.hidden = true;
  respuesta.data.forEach((solicitud) => {
    lista.append(crearTarjetaSolicitud(solicitud));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', cargarSolicitudesDirigente);
} else {
  cargarSolicitudesDirigente();
}
