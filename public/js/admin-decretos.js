'use strict';

const etiquetasDecreto = {
  pendiente: 'Pendiente por visar',
  firmado: 'Firmado',
  devuelto: 'Devuelto'
};

function mostrarMensajeListaDecretos(mensaje, error) {
  const estado = document.querySelector('[data-list-message]');
  estado.textContent = mensaje;
  estado.dataset.tipo = error ? 'error' : 'aviso';
  estado.hidden = false;
}

function formatearFechaDecreto(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    return 'Fecha pendiente';
  }
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}-${mes}-${anio}`;
}

function crearCeldaDecreto(valor) {
  const celda = document.createElement('td');
  celda.textContent = valor || '—';
  return celda;
}

function crearFilaDecreto(decreto) {
  const fila = document.createElement('tr');
  const folio = document.createElement('td');
  const enlace = document.createElement('a');
  enlace.href = `/admin/decreto.html?id=${encodeURIComponent(decreto.decreto_id)}`;
  enlace.textContent = decreto.folio;
  folio.append(enlace);

  const organizacion = document.createElement('td');
  const nombre = document.createElement('strong');
  const dirigente = document.createElement('span');
  nombre.textContent = decreto.organizacion_nombre;
  dirigente.textContent = decreto.dirigente_nombre;
  dirigente.className = 'table-secondary-text';
  organizacion.append(nombre, document.createElement('br'), dirigente);

  const bus = decreto.bus_nombre
    ? `${decreto.bus_nombre} · ${decreto.bus_patente}`
    : 'Sin bus asignado';
  const estado = document.createElement('span');
  estado.className = `state-badge state-${decreto.decreto_estado}`;
  estado.textContent = etiquetasDecreto[decreto.decreto_estado] || decreto.decreto_estado;
  const celdaEstado = document.createElement('td');
  celdaEstado.append(estado);

  const revision = document.createElement('td');
  const minutos = decreto.minutos_restantes === null
    ? null
    : Number(decreto.minutos_restantes);
  if (minutos !== null && minutos < 48 * 60) {
    revision.className = 'table-warning';
    revision.textContent = minutos < 0
      ? 'Salida vencida'
      : 'Menos de 48 horas';
  } else {
    revision.textContent = 'Plazo disponible';
  }

  fila.append(
    folio,
    organizacion,
    crearCeldaDecreto(decreto.destino),
    crearCeldaDecreto(formatearFechaDecreto(decreto.fecha_salida)),
    crearCeldaDecreto(bus),
    celdaEstado,
    revision
  );
  return fila;
}

async function cargarDecretos() {
  const mensaje = document.querySelector('[data-list-message]');
  const cuerpo = document.querySelector('[data-decrees-body]');
  const estado = document.querySelector('[data-filter-state]').value;
  mensaje.textContent = 'Cargando decretos...';
  mensaje.dataset.tipo = 'aviso';
  mensaje.hidden = false;
  cuerpo.replaceChildren();

  const respuesta = await window.apiFetch(
    `/api/admin/decretos?estado=${encodeURIComponent(estado)}`
  );
  if (!respuesta.ok) {
    mostrarMensajeListaDecretos(respuesta.error, true);
    return;
  }

  if (respuesta.data.length === 0) {
    mostrarMensajeListaDecretos('No hay decretos con este estado.', false);
    return;
  }

  respuesta.data.forEach((decreto) => {
    cuerpo.append(crearFilaDecreto(decreto));
  });
  mensaje.hidden = true;
}

function iniciarBandejaDecretos() {
  document.querySelector('[data-filter-form]').addEventListener('submit', (evento) => {
    evento.preventDefault();
    cargarDecretos();
  });
  cargarDecretos();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarBandejaDecretos);
} else {
  iniciarBandejaDecretos();
}
