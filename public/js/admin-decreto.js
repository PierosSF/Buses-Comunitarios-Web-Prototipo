'use strict';

const etiquetasEstadoDecreto = {
  pendiente: 'Pendiente por visar',
  firmado: 'Firmado',
  devuelto: 'Devuelto a DIDECO'
};

const etiquetasMotivoDecreto = {
  recreativa: 'Recreativa para adultos mayores',
  deportiva: 'Deportiva',
  cultural: 'Cultural',
  educativa: 'Educativa'
};

function mostrarMensajeDecreto(mensaje, tipo) {
  const estado = document.querySelector('[data-detail-message]');
  estado.textContent = mensaje;
  estado.dataset.tipo = tipo || 'error';
  estado.hidden = false;
}

function formatearFechaDecreto(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    return 'Fecha pendiente';
  }
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}-${mes}-${anio}`;
}

function formatearFechaHoraFirma(fecha) {
  if (!fecha) {
    return 'No registrada';
  }
  return String(fecha).replace('T', ' ').slice(0, 16);
}

function agregarDatoDecreto(lista, etiqueta, valor) {
  const fila = document.createElement('div');
  const nombre = document.createElement('dt');
  const dato = document.createElement('dd');
  nombre.textContent = etiqueta;
  dato.textContent = valor || 'No indicado';
  fila.append(nombre, dato);
  lista.append(fila);
}

function renderizarDatosDocumento(datos) {
  const contenido = datos.contenido || {};
  const solicitud = datos.solicitud;
  const bus = contenido.bus || datos.bus;
  const pasajeros = Array.isArray(contenido.pasajeros)
    ? contenido.pasajeros
    : datos.pasajeros;
  const lista = document.querySelector('[data-decree-data]');
  lista.replaceChildren();

  agregarDatoDecreto(lista, 'Vehículo', bus
    ? `${bus.nombre} · Patente ${bus.patente} · ${bus.asientos} asientos`
    : 'Sin bus asignado');
  agregarDatoDecreto(lista, 'Fecha de circulación', formatearFechaDecreto(
    contenido.fecha_salida || solicitud.fecha_salida
  ));
  agregarDatoDecreto(lista, 'Horario', [
    contenido.hora_salida || solicitud.hora_salida,
    contenido.hora_regreso || solicitud.hora_regreso
  ].filter(Boolean).map((hora) => String(hora).slice(0, 5)).join(' a '));
  agregarDatoDecreto(lista, 'Destino', contenido.destino || solicitud.destino);
  agregarDatoDecreto(lista, 'Organización solicitante',
    contenido.organizacion && contenido.organizacion.nombre
      ? contenido.organizacion.nombre
      : solicitud.organizacion.nombre);
  agregarDatoDecreto(lista, 'Dirigente solicitante', solicitud.dirigente.nombre);
  agregarDatoDecreto(lista, 'Motivo', etiquetasMotivoDecreto[
    contenido.motivo || solicitud.motivo
  ] || contenido.motivo || solicitud.motivo);

  document.querySelector('[data-decree-heading]').textContent =
    `Decreto de circulación · ${solicitud.folio}`;
  document.querySelector('[data-decree-number]').textContent =
    datos.decreto.numero || `Expediente ${solicitud.folio}`;
  renderizarPasajerosDecreto(pasajeros, datos.pasajeros);
}

function renderizarPasajerosDecreto(pasajeros, pasajerosRevisados) {
  const cuerpo = document.querySelector('[data-passengers-body]');
  cuerpo.replaceChildren();

  if (!pasajeros.length) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 4;
    celda.textContent = 'No hay pasajeros registrados en el expediente.';
    fila.append(celda);
    cuerpo.append(fila);
    return;
  }

  pasajeros.forEach((pasajero, indice) => {
    const pasajeroRevisado = pasajerosRevisados.find((actual) => (
      actual.rut_normalizado === window.Rut.limpiarRut(pasajero.rut)
    ));
    const rutValido = Boolean(
      pasajeroRevisado
      && pasajeroRevisado.rut_valido
      && !pasajeroRevisado.rut_duplicado
    );
    const fila = document.createElement('tr');
    const numero = document.createElement('td');
    const nombre = document.createElement('td');
    const rut = document.createElement('td');
    const revision = document.createElement('td');
    const estado = document.createElement('span');

    numero.textContent = String(indice + 1);
    nombre.textContent = pasajero.nombre || 'Nombre pendiente';
    rut.textContent = pasajero.rut
      ? window.Rut.formatearRut(pasajero.rut)
      : 'RUT pendiente';
    estado.className = `review-mark ${rutValido ? 'is-valid' : 'is-invalid'}`;
    estado.textContent = rutValido ? '✓ Válido' : '! Revisar';
    revision.append(estado);
    fila.append(numero, nombre, rut, revision);
    cuerpo.append(fila);
  });
}

function renderizarRevision(datos) {
  const revision = datos.revision;
  const estado = document.querySelector('[data-review-state]');
  if (datos.decreto.estado === 'firmado') {
    estado.textContent = `✓ Decreto firmado · ${datos.decreto.numero}`;
    estado.className = 'review-state is-valid';
  } else if (datos.decreto.estado === 'devuelto') {
    estado.textContent = 'Decreto devuelto; la solicitud volvió a revisión de DIDECO.';
    estado.className = 'review-state is-returned';
  } else {
    estado.textContent = revision.puede_firmar
      ? '✓ Expediente apto para firmar'
      : '! El expediente requiere correcciones antes de firmar';
    estado.className = `review-state ${revision.puede_firmar ? 'is-valid' : 'is-invalid'}`;
  }

  const lista = document.querySelector('[data-review-checks]');
  lista.replaceChildren();
  revision.checks.forEach((check) => {
    const fila = document.createElement('li');
    const marca = document.createElement('span');
    const detalle = document.createElement('span');
    fila.className = `review-check ${check.ok ? 'is-valid' : 'is-invalid'}`;
    marca.setAttribute('aria-hidden', 'true');
    marca.textContent = check.ok ? '✓' : '!';
    detalle.textContent = `${check.etiqueta}: ${check.detalle}`;
    fila.append(marca, detalle);
    lista.append(fila);
  });

  const advertencia = document.querySelector('[data-deadline-warning]');
  if (revision.advertencia_48_horas) {
    const horas = revision.horas_restantes;
    advertencia.textContent = horas !== null && horas < 0
      ? 'La hora de salida ya pasó. Verifique la fecha antes de continuar.'
      : `Advertencia: faltan menos de 48 horas para la salida (${horas} h).`;
    advertencia.hidden = false;
  } else {
    advertencia.hidden = true;
  }

  const observacion = document.querySelector('[data-existing-observation]');
  if (datos.decreto.observacion) {
    observacion.textContent = `Observación anterior: ${datos.decreto.observacion}`;
    observacion.hidden = false;
  } else {
    observacion.hidden = true;
  }
}

function renderizarFirma(decreto) {
  const detalle = document.querySelector('[data-signature-details]');
  detalle.hidden = decreto.estado !== 'firmado';
  if (detalle.hidden) {
    return;
  }
  document.querySelector('[data-signatory]').textContent =
    decreto.firmante_nombre || 'Administrador Municipal';
  document.querySelector('[data-signature-date]').textContent =
    formatearFechaHoraFirma(decreto.firmado_at);
  document.querySelector('[data-signature-hash]').textContent =
    decreto.hash_firma || 'Hash no disponible';
}

function renderizarDecreto(datos) {
  document.querySelector('[data-detail-message]').hidden = true;
  document.querySelector('[data-decree-workspace]').hidden = false;
  renderizarDatosDocumento(datos);
  renderizarRevision(datos);
  renderizarFirma(datos.decreto);

  document.querySelector('[data-review-state]').dataset.estado =
    datos.decreto.estado;
  const acciones = document.querySelector('[data-decree-actions]');
  acciones.hidden = datos.decreto.estado !== 'pendiente';
  const firmar = document.querySelector('[data-sign-action]');
  firmar.disabled = !datos.revision.puede_firmar;

  const estado = etiquetasEstadoDecreto[datos.decreto.estado] || datos.decreto.estado;
  document.querySelector('[data-review-state]').setAttribute(
    'aria-label',
    `Estado del decreto: ${estado}`
  );
  document.title = `Decreto ${datos.solicitud.folio} | Buses Comunitarios`;
}

async function cargarDecreto() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id || !/^[1-9]\d*$/.test(id)) {
    mostrarMensajeDecreto('El enlace no incluye un número de decreto válido.');
    return null;
  }
  const respuesta = await window.apiFetch(`/api/admin/decretos/${encodeURIComponent(id)}`);
  if (!respuesta.ok) {
    mostrarMensajeDecreto(respuesta.error);
    return null;
  }
  renderizarDecreto(respuesta.data);
  return respuesta.data;
}

function bloquearAcciones(bloqueadas) {
  document.querySelector('[data-sign-action]').disabled = bloqueadas;
  document.querySelector('[data-return-action]').disabled = bloqueadas;
}

async function firmarDecreto() {
  if (!window.confirm(
    '¿Confirma firmar y emitir este decreto? La firma es de demostración y no tiene validez legal.'
  )) {
    return;
  }
  const id = new URLSearchParams(window.location.search).get('id');
  bloquearAcciones(true);
  mostrarMensajeDecreto('Registrando la firma de demostración...', 'aviso');

  const respuesta = await window.apiFetch(
    `/api/admin/decretos/${encodeURIComponent(id)}/firmar`,
    { method: 'POST', body: JSON.stringify({}) }
  );
  if (!respuesta.ok) {
    await cargarDecreto();
    mostrarMensajeDecreto(respuesta.error);
    return;
  }

  await cargarDecreto();
  mostrarMensajeDecreto(
    `Decreto ${respuesta.data.numero} emitido. La firma de demostración quedó registrada.`,
    'exito'
  );
}

async function devolverDecreto(evento) {
  evento.preventDefault();
  const observacion = document.querySelector('[data-return-observation]').value.trim();
  if (!observacion) {
    mostrarMensajeDecreto('Escriba una observación para que DIDECO sepa qué debe revisar.');
    document.querySelector('[data-return-observation]').focus();
    return;
  }

  const id = new URLSearchParams(window.location.search).get('id');
  bloquearAcciones(true);
  const respuesta = await window.apiFetch(
    `/api/admin/decretos/${encodeURIComponent(id)}/devolver`,
    { method: 'POST', body: JSON.stringify({ observacion }) }
  );
  if (!respuesta.ok) {
    await cargarDecreto();
    mostrarMensajeDecreto(respuesta.error);
    return;
  }

  await cargarDecreto();
  mostrarMensajeDecreto(
    'El decreto fue devuelto a DIDECO y la solicitud volvió a revisión.',
    'exito'
  );
}

function iniciarDetalleDecreto() {
  document.querySelector('[data-sign-action]').addEventListener('click', firmarDecreto);
  document.querySelector('[data-return-form]').addEventListener('submit', devolverDecreto);
  document.querySelector('[data-print-action]').addEventListener('click', () => {
    document.body.classList.add('printing-admin-decree');
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-admin-decree');
    }, { once: true });
    window.print();
  });
  cargarDecreto();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarDetalleDecreto);
} else {
  iniciarDetalleDecreto();
}
