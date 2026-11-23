'use strict';

function mostrarMensajeDideco(mensaje, tipo) {
  const estado = document.querySelector('[data-detail-message]');
  estado.textContent = mensaje;
  estado.dataset.tipo = tipo || 'error';
  estado.hidden = false;
}

function crearDatoDideco(etiqueta, valor) {
  const fila = document.createElement('div');
  const nombre = document.createElement('dt');
  const dato = document.createElement('dd');
  nombre.textContent = etiqueta;
  dato.textContent = valor || 'No indicado';
  fila.append(nombre, dato);
  return fila;
}

function formatearFechaEvento(valor) {
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

function renderizarPasajerosDideco(pasajeros) {
  const cuerpo = document.querySelector('[data-passengers-body]');
  cuerpo.replaceChildren();

  if (pasajeros.length === 0) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 4;
    celda.textContent = 'La solicitud no tiene pasajeros registrados.';
    fila.append(celda);
    cuerpo.append(fila);
    return;
  }

  pasajeros.forEach((pasajero, indice) => {
    const fila = document.createElement('tr');
    const numero = document.createElement('td');
    const nombre = document.createElement('td');
    const rut = document.createElement('td');
    const validacion = document.createElement('td');
    const estadoRut = document.createElement('span');

    numero.textContent = String(indice + 1);
    nombre.textContent = pasajero.nombre || 'Nombre pendiente';
    rut.textContent = pasajero.rut
      ? window.Rut.formatearRut(pasajero.rut)
      : 'RUT pendiente';
    const rutValido = pasajero.rut_valido && !pasajero.rut_duplicado;
    estadoRut.className = `rut-review-status ${rutValido ? 'is-valid' : 'is-invalid'}`;
    estadoRut.textContent = rutValido
      ? '✓ Válido'
      : pasajero.rut_duplicado
        ? '✕ Repetido'
        : '✕ No válido';
    validacion.append(estadoRut);
    fila.append(numero, nombre, rut, validacion);
    cuerpo.append(fila);
  });
}

function renderizarHistorialDideco(historial) {
  const lista = document.querySelector('[data-request-history]');
  lista.replaceChildren();

  if (historial.length === 0) {
    const elemento = document.createElement('li');
    elemento.textContent = 'Aún no hay cambios de estado registrados.';
    lista.append(elemento);
    return;
  }

  historial.forEach((evento) => {
    const elemento = document.createElement('li');
    const titulo = document.createElement('strong');
    const fecha = document.createElement('time');
    const comentario = document.createElement('p');
    const anterior = evento.estado_anterior
      ? window.SolicitudesUI.etiquetaEstado(evento.estado_anterior)
      : 'Solicitud creada';
    titulo.textContent = `${anterior} → ${window.SolicitudesUI.etiquetaEstado(evento.estado_nuevo)}`;
    fecha.dateTime = evento.created_at || '';
    fecha.textContent = formatearFechaEvento(evento.created_at);
    comentario.textContent = [
      evento.comentario || '',
      evento.usuario_nombre ? `Responsable: ${evento.usuario_nombre}` : ''
    ].filter(Boolean).join(' ');
    elemento.append(titulo, fecha);
    if (comentario.textContent) {
      elemento.append(comentario);
    }
    lista.append(elemento);
  });
}

function renderizarBusesDisponibles(buses) {
  const selector = document.querySelector('[data-bus-select]');
  const boton = document.querySelector('[data-assign-action]');
  selector.replaceChildren();

  const opcionInicial = document.createElement('option');
  opcionInicial.value = '';
  opcionInicial.textContent = buses.length
    ? 'Seleccione un bus'
    : 'No hay buses libres con capacidad suficiente';
  selector.append(opcionInicial);

  buses.forEach((bus) => {
    const opcion = document.createElement('option');
    opcion.value = String(bus.id);
    opcion.textContent = `${bus.nombre} · ${bus.patente} · ${bus.asientos} asientos`;
    selector.append(opcion);
  });
  boton.disabled = buses.length === 0;
}

function renderizarDetalleDideco(datos) {
  const solicitud = datos.solicitud;
  document.querySelector('[data-detail-title]').textContent =
    `Solicitud ${solicitud.folio}`;

  const estado = document.querySelector('[data-detail-state]');
  estado.className = `state-badge state-${solicitud.estado}`;
  estado.textContent = window.SolicitudesUI.etiquetaEstado(solicitud.estado);

  const motivo = {
    recreativa: 'Recreativa para adultos mayores',
    deportiva: 'Deportiva',
    cultural: 'Cultural',
    educativa: 'Educativa'
  };
  const estadoDecreto = {
    pendiente: 'Pendiente de firma',
    firmado: 'Firmado',
    devuelto: 'Devuelto por Administración'
  };
  const resumen = document.querySelector('[data-request-data]');
  resumen.replaceChildren(
    crearDatoDideco('Organización', solicitud.organizacion.nombre),
    crearDatoDideco('Sector', solicitud.organizacion.sector),
    crearDatoDideco('Dirigente', `${solicitud.dirigente.nombre} · ${window.Rut.formatearRut(solicitud.dirigente.rut)}`),
    crearDatoDideco('Destino', solicitud.destino),
    crearDatoDideco('Fecha de salida', window.SolicitudesUI.formatearFecha(solicitud.fecha_salida)),
    crearDatoDideco('Hora de salida', window.SolicitudesUI.formatearHora(solicitud.hora_salida)),
    crearDatoDideco('Hora de regreso', window.SolicitudesUI.formatearHora(solicitud.hora_regreso)),
    crearDatoDideco('Motivo', motivo[solicitud.motivo] || solicitud.motivo),
    crearDatoDideco(
      'Bus asignado',
      datos.bus
        ? `${datos.bus.nombre} (${datos.bus.patente}, ${datos.bus.asientos} asientos)`
        : 'Pendiente de asignación'
    ),
    crearDatoDideco('Estado del decreto', datos.decreto
      ? estadoDecreto[datos.decreto.estado] || datos.decreto.estado
      : 'Aún no creado')
  );

  const observacion = document.querySelector('[data-dideco-observation]');
  if (solicitud.observacion_dideco) {
    observacion.textContent = `Observación anterior: ${solicitud.observacion_dideco}`;
    observacion.hidden = false;
  } else {
    observacion.hidden = true;
  }

  renderizarPasajerosDideco(datos.pasajeros);
  renderizarHistorialDideco(datos.historial);

  const enRevision = solicitud.estado === 'en_revision';
  document.querySelector('[data-review-action]').hidden = solicitud.estado !== 'enviada';
  document.querySelector('[data-assignment-actions]').hidden = !enRevision;
  document.querySelector('[data-decision-actions]').hidden = !enRevision;
  if (enRevision) {
    renderizarBusesDisponibles(datos.buses_disponibles);
  }
}

async function cargarDetalleDideco(mostrarCarga) {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id || !/^[1-9]\d*$/.test(id)) {
    mostrarMensajeDideco('El enlace no incluye un número de solicitud válido.');
    return false;
  }

  if (mostrarCarga) {
    mostrarMensajeDideco('Cargando el detalle de la solicitud...', 'aviso');
  }
  const respuesta = await window.apiFetch(`/api/dideco/solicitudes/${encodeURIComponent(id)}`);
  if (!respuesta.ok) {
    mostrarMensajeDideco(respuesta.error);
    return false;
  }

  renderizarDetalleDideco(respuesta.data);
  document.querySelector('[data-dideco-detail]').hidden = false;
  document.querySelector('[data-detail-message]').hidden = true;
  return true;
}

async function ejecutarAccionDideco(ruta, datos, mensajeExito) {
  const botones = Array.from(document.querySelectorAll(
    '[data-review-action], [data-assign-action], [data-decision]'
  ));
  botones.forEach((elemento) => {
    elemento.disabled = true;
  });

  try {
    const respuesta = await window.apiFetch(ruta, {
      method: 'POST',
      body: JSON.stringify(datos)
    });
    if (!respuesta.ok) {
      mostrarMensajeDideco(respuesta.error);
      return;
    }

    const actualizado = await cargarDetalleDideco(false);
    if (!actualizado) {
      return;
    }
    mostrarMensajeDideco(mensajeExito, 'exito');
  } catch (error) {
    console.error('No fue posible completar la acción de DIDECO.', error);
    mostrarMensajeDideco('No fue posible guardar la decisión. Inténtelo nuevamente.');
  } finally {
    botones.forEach((elemento) => {
      elemento.disabled = false;
    });
    const selector = document.querySelector('[data-bus-select]');
    const asignar = document.querySelector('[data-assign-action]');
    if (selector && asignar && selector.options.length <= 1) {
      asignar.disabled = true;
    }
  }
}

function iniciarDetalleDideco() {
  const id = new URLSearchParams(window.location.search).get('id');

  document.querySelector('[data-review-action]').addEventListener('click', () => {
    ejecutarAccionDideco(
      `/api/dideco/solicitudes/${encodeURIComponent(id)}/revision`,
      {},
      'La solicitud pasó a revisión.'
    );
  });

  document.querySelector('[data-assign-action]').addEventListener('click', () => {
    const busId = document.querySelector('[data-bus-select]').value;
    if (!busId) {
      mostrarMensajeDideco('Seleccione un bus disponible antes de continuar.');
      return;
    }
    ejecutarAccionDideco(
      `/api/dideco/solicitudes/${encodeURIComponent(id)}/asignar-bus`,
      { bus_id: Number(busId) },
      'El bus quedó asignado y se creó el decreto pendiente.'
    );
  });

  document.querySelectorAll('[data-decision]').forEach((boton) => {
    boton.addEventListener('click', (evento) => {
      const comentario = document.querySelector('[data-decision-comment]').value.trim();
      const accion = evento.currentTarget.dataset.decision;
      if (!comentario) {
        mostrarMensajeDideco('Escriba un comentario para explicar la devolución o el rechazo.');
        document.querySelector('[data-decision-comment]').focus();
        return;
      }

      ejecutarAccionDideco(
        `/api/dideco/solicitudes/${encodeURIComponent(id)}/${accion}`,
        { comentario },
        accion === 'devolver'
          ? 'La solicitud fue devuelta al dirigente para corregirla.'
          : 'La solicitud fue rechazada.'
      );
    });
  });

  cargarDetalleDideco(true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarDetalleDideco);
} else {
  iniciarDetalleDideco();
}
