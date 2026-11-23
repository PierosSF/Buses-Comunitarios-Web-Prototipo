'use strict';

let solicitudEnviada = false;

function mostrarMensajeSolicitud(mensaje, tipo) {
  const estado = document.querySelector('[data-form-message]');
  estado.textContent = mensaje;
  estado.dataset.tipo = tipo || 'error';
  estado.hidden = false;
}

function limpiarMensajeSolicitud() {
  const estado = document.querySelector('[data-form-message]');
  estado.textContent = '';
  estado.hidden = true;
  delete estado.dataset.tipo;
}

function crearFilaPasajero(pasajero, enfocar) {
  const tabla = document.querySelector('[data-passenger-rows]');
  const numero = tabla.rows.length + 1;
  const fila = document.createElement('tr');
  const celdaNombre = document.createElement('td');
  const celdaRut = document.createElement('td');
  const celdaEstado = document.createElement('td');
  const celdaAccion = document.createElement('td');
  const campoNombre = document.createElement('input');
  const campoRut = document.createElement('input');
  const estadoRut = document.createElement('span');
  const botonQuitar = document.createElement('button');
  const idEstado = `estado-rut-${Date.now()}-${numero}`;

  fila.dataset.passengerRow = 'true';
  campoNombre.type = 'text';
  campoNombre.maxLength = 150;
  campoNombre.autocomplete = 'name';
  campoNombre.setAttribute('aria-label', `Nombre completo del pasajero ${numero}`);
  campoNombre.dataset.passengerName = 'true';
  campoNombre.value = pasajero && pasajero.nombre ? pasajero.nombre : '';

  campoRut.type = 'text';
  campoRut.inputMode = 'text';
  campoRut.autocapitalize = 'characters';
  campoRut.spellcheck = false;
  campoRut.maxLength = 12;
  campoRut.setAttribute('aria-label', `RUT del pasajero ${numero}`);
  campoRut.dataset.passengerRut = 'true';
  campoRut.value = pasajero && pasajero.rut
    ? window.Rut.formatearRut(pasajero.rut)
    : '';

  estadoRut.id = idEstado;
  estadoRut.className = 'rut-status';
  estadoRut.setAttribute('role', 'status');
  estadoRut.setAttribute('aria-live', 'polite');
  campoRut.setAttribute('aria-describedby', idEstado);

  botonQuitar.type = 'button';
  botonQuitar.className = 'button-remove';
  botonQuitar.textContent = 'Quitar';
  botonQuitar.setAttribute('aria-label', `Quitar pasajero ${numero}`);
  botonQuitar.addEventListener('click', () => {
    fila.remove();
    actualizarNómina();
  });

  celdaNombre.append(campoNombre);
  celdaRut.append(campoRut);
  celdaEstado.append(estadoRut);
  celdaAccion.append(botonQuitar);
  fila.append(celdaNombre, celdaRut, celdaEstado, celdaAccion);
  tabla.append(fila);

  campoNombre.addEventListener('input', actualizarNómina);
  campoRut.addEventListener('input', () => {
    const inicio = campoRut.selectionStart;
    const caracteresAntes = campoRut.value
      .slice(0, inicio)
      .replace(/[.\s-]/g, '').length;
    const formato = window.Rut.formatearRut(campoRut.value, true);
    campoRut.value = formato;

    let posicion = 0;
    let caracteresContados = 0;
    while (posicion < formato.length && caracteresContados < caracteresAntes) {
      if (/[0-9K]/.test(formato[posicion])) {
        caracteresContados += 1;
      }
      posicion += 1;
    }
    if (formato.endsWith('-') && campoRut.value.endsWith('-')) {
      posicion = formato.length;
    }
    campoRut.setSelectionRange(posicion, posicion);
    actualizarNómina();
  });
  campoRut.addEventListener('blur', () => {
    campoRut.value = window.Rut.formatearRut(campoRut.value);
    actualizarNómina();
  });

  actualizarNómina();
  if (enfocar) {
    campoNombre.focus();
  }
}

function actualizarNómina() {
  const tabla = document.querySelector('[data-passenger-rows]');
  const filas = Array.from(tabla.querySelectorAll('[data-passenger-row]'));
  const botónAgregar = document.querySelector('[data-add-passenger]');
  const contador = document.querySelector('[data-passenger-count]');
  const ocupados = filas.filter((fila) => (
    fila.querySelector('[data-passenger-name]').value.trim()
    || fila.querySelector('[data-passenger-rut]').value.trim()
  )).length;
  const repetidos = new Map();

  filas.forEach((fila) => {
    const campoRut = fila.querySelector('[data-passenger-rut]');
    const rut = window.Rut.limpiarRut(campoRut.value);
    if (rut) {
      repetidos.set(rut, (repetidos.get(rut) || 0) + 1);
    }
  });

  filas.forEach((fila) => {
    const campoRut = fila.querySelector('[data-passenger-rut]');
    const campoNombre = fila.querySelector('[data-passenger-name]');
    const estado = fila.querySelector('.rut-status');
    const rutIngresado = campoRut.value.trim();
    const rut = window.Rut.limpiarRut(campoRut.value);
    estado.classList.remove('is-valid', 'is-invalid');

    if (!rutIngresado && campoNombre.value.trim()) {
      estado.textContent = '✕ Ingrese el RUT de este pasajero.';
      estado.classList.add('is-invalid');
      campoRut.setAttribute('aria-invalid', 'true');
    } else if (!rutIngresado) {
      estado.textContent = 'Ingrese el RUT.';
      campoRut.setAttribute('aria-invalid', 'false');
    } else if (repetidos.get(rut) > 1) {
      estado.textContent = '✕ RUT repetido. Revise la nómina.';
      estado.classList.add('is-invalid');
      campoRut.setAttribute('aria-invalid', 'true');
    } else if (!window.Rut.validarRut(rut)) {
      estado.textContent = '✕ RUT no válido. Revise el número y el dígito verificador.';
      estado.classList.add('is-invalid');
      campoRut.setAttribute('aria-invalid', 'true');
    } else {
      estado.textContent = '✓ RUT válido.';
      estado.classList.add('is-valid');
      campoRut.setAttribute('aria-invalid', 'false');
    }
  });

  contador.textContent = `${ocupados} de 36 cupos`;
  botónAgregar.disabled = filas.length >= 36 || solicitudEnviada;
  botónAgregar.setAttribute('aria-disabled', String(filas.length >= 36 || solicitudEnviada));
}

function obtenerPasajeros() {
  return Array.from(document.querySelectorAll('[data-passenger-row]'))
    .map((fila) => ({
      nombre: fila.querySelector('[data-passenger-name]').value.trim(),
      rut: fila.querySelector('[data-passenger-rut]').value.trim()
    }))
    .filter((pasajero) => pasajero.nombre || pasajero.rut);
}

function datosDelViaje() {
  return {
    destino: document.querySelector('[name="destino"]').value.trim(),
    fecha_salida: document.querySelector('[name="fecha_salida"]').value,
    hora_salida: document.querySelector('[name="hora_salida"]').value,
    hora_regreso: document.querySelector('[name="hora_regreso"]').value,
    motivo: document.querySelector('[name="motivo"]').value,
    pasajeros: obtenerPasajeros()
  };
}

function validarParaEnviar(datos) {
  if (!datos.destino) {
    return 'Ingrese el destino del viaje.';
  }
  if (!datos.fecha_salida) {
    return 'Seleccione la fecha de salida.';
  }
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaSalida = new Date(`${datos.fecha_salida}T00:00:00`);
  if (!Number.isFinite(fechaSalida.getTime()) || fechaSalida <= hoy) {
    return 'La fecha de salida debe ser posterior a hoy.';
  }
  if (!datos.hora_salida || !datos.hora_regreso) {
    return 'Ingrese la hora de salida y la hora de regreso.';
  }
  if (!datos.motivo) {
    return 'Seleccione el motivo del viaje.';
  }
  if (datos.pasajeros.length < 1 || datos.pasajeros.length > 36) {
    return 'La nómina debe tener entre 1 y 36 pasajeros.';
  }

  const ruts = new Set();
  for (let indice = 0; indice < datos.pasajeros.length; indice += 1) {
    const pasajero = datos.pasajeros[indice];
    const rut = window.Rut.limpiarRut(pasajero.rut);

    if (!pasajero.nombre) {
      return `Ingrese el nombre del pasajero ${indice + 1}.`;
    }
    if (!rut || !window.Rut.validarRut(rut)) {
      return `Revise el RUT del pasajero ${indice + 1}.`;
    }
    if (ruts.has(rut)) {
      return `El RUT del pasajero ${indice + 1} está repetido.`;
    }
    ruts.add(rut);
  }

  return '';
}

function mostrarEnlaceDetalle(solicitud) {
  const enlace = document.querySelector('[data-open-detail]');
  enlace.href = `/dirigente/solicitud.html?id=${encodeURIComponent(solicitud.id)}`;
  enlace.textContent = `Ver solicitud ${solicitud.folio}`;
  enlace.hidden = false;
}

async function guardarBorrador(datos) {
  const id = new URLSearchParams(window.location.search).get('id');
  const ruta = id
    ? `/api/solicitudes/${encodeURIComponent(id)}`
    : '/api/solicitudes';
  const respuesta = await window.apiFetch(ruta, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(datos)
  });

  if (!respuesta.ok) {
    mostrarMensajeSolicitud(respuesta.error);
    return null;
  }

  const solicitud = respuesta.data;
  if (!id) {
    window.history.replaceState(null, '', `?id=${encodeURIComponent(solicitud.id)}`);
    document.querySelector('[data-form-title]').textContent = 'Editar borrador';
  }
  mostrarEnlaceDetalle(solicitud);
  mostrarMensajeSolicitud(
    solicitud.estado === 'devuelta'
      ? `Las correcciones de la solicitud ${solicitud.folio} quedaron guardadas. Puede reenviarla cuando esté lista.`
      : `Borrador ${solicitud.folio} guardado correctamente.`,
    'exito'
  );
  return solicitud;
}

async function enviarSolicitud(datos) {
  const guardada = await guardarBorrador(datos);
  if (!guardada) {
    return;
  }

  const respuesta = await window.apiFetch(
    `/api/solicitudes/${encodeURIComponent(guardada.id)}/enviar`,
    { method: 'POST', body: JSON.stringify({}) }
  );

  if (!respuesta.ok) {
    mostrarMensajeSolicitud(`${respuesta.error} El borrador ${guardada.folio} quedó guardado.`);
    return;
  }

  mostrarMensajeSolicitud(
    `La solicitud ${respuesta.data.folio} fue enviada correctamente.`,
    'exito'
  );
  mostrarEnlaceDetalle({ id: guardada.id, folio: respuesta.data.folio });
  solicitudEnviada = true;
  document.querySelector('[data-form-title]').textContent = 'Solicitud enviada';
  document.querySelector('[data-form-description]').textContent =
    'La Municipalidad recibió su solicitud. Puede revisar su estado y autorización en el detalle.';
  document.querySelector('[data-request-form]').hidden = true;
  document.querySelectorAll('[data-request-form] input, [data-request-form] select, [data-request-form] textarea, [data-request-form] button')
    .forEach((control) => {
      control.disabled = true;
    });
}

async function cargarBorrador(id) {
  const respuesta = await window.apiFetch(`/api/solicitudes/${encodeURIComponent(id)}`);

  if (!respuesta.ok) {
    mostrarMensajeSolicitud(respuesta.error);
    return false;
  }

  const datos = respuesta.data;
  if (!['borrador', 'devuelta'].includes(datos.solicitud.estado)) {
    window.location.replace(`/dirigente/solicitud.html?id=${encodeURIComponent(id)}`);
    return false;
  }

  const solicitud = datos.solicitud;
  const esDevuelta = solicitud.estado === 'devuelta';
  document.querySelector('[data-form-title]').textContent = esDevuelta
    ? `Corregir solicitud ${solicitud.folio}`
    : `Editar borrador ${solicitud.folio}`;
  if (esDevuelta) {
    document.querySelector('[data-form-description]').textContent =
      'DIDECO devolvió esta solicitud para corregirla. Revise la observación y vuelva a enviarla.';
    document.querySelector('[data-save-draft]').textContent = 'Guardar correcciones';
    document.querySelector('[data-send-request]').textContent = 'Reenviar solicitud';
  }
  document.querySelector('[name="destino"]').value = solicitud.destino || '';
  document.querySelector('[name="fecha_salida"]').value = solicitud.fecha_salida || '';
  document.querySelector('[name="hora_salida"]').value = solicitud.hora_salida
    ? solicitud.hora_salida.slice(0, 5)
    : '';
  document.querySelector('[name="hora_regreso"]').value = solicitud.hora_regreso
    ? solicitud.hora_regreso.slice(0, 5)
    : '';
  document.querySelector('[name="motivo"]').value = solicitud.motivo || '';

  const tabla = document.querySelector('[data-passenger-rows]');
  tabla.replaceChildren();
  datos.pasajeros.forEach((pasajero) => crearFilaPasajero(pasajero, false));
  if (datos.pasajeros.length === 0) {
    crearFilaPasajero(undefined, false);
  }
  mostrarEnlaceDetalle(solicitud);
  if (esDevuelta) {
    mostrarMensajeSolicitud(
      solicitud.observacion_dideco
        ? `Observación de DIDECO: ${solicitud.observacion_dideco}`
        : 'DIDECO solicitó correcciones antes de continuar.',
      'aviso'
    );
  } else {
    limpiarMensajeSolicitud();
  }
  return true;
}

function importarPasajeros() {
  const texto = document.querySelector('[data-paste-passengers]').value;
  const lineas = texto.split(/\r?\n/).map((linea) => linea.trim()).filter(Boolean);
  const filas = Array.from(document.querySelectorAll('[data-passenger-row]'));
  const filasVacias = filas.filter((fila) => (
    !fila.querySelector('[data-passenger-name]').value.trim()
    && !fila.querySelector('[data-passenger-rut]').value.trim()
  ));
  const filasActuales = filas.length - filasVacias.length;
  const cuposDisponibles = 36 - filasActuales;

  if (lineas.length > cuposDisponibles) {
    mostrarMensajeSolicitud(`Puede agregar ${cuposDisponibles} filas más. La nómina admite hasta 36 pasajeros.`);
    return;
  }

  const pasajeros = [];
  for (let indice = 0; indice < lineas.length; indice += 1) {
    const separador = lineas[indice].indexOf(';');
    if (separador < 1) {
      mostrarMensajeSolicitud(`La línea ${indice + 1} no tiene el formato Nombre; RUT.`);
      return;
    }
    pasajeros.push({
      nombre: lineas[indice].slice(0, separador).trim(),
      rut: lineas[indice].slice(separador + 1).trim()
    });
  }

  if (lineas.length === 0) {
    mostrarMensajeSolicitud('Pegue al menos una línea con formato Nombre; RUT.');
    return;
  }

  filasVacias.forEach((fila) => fila.remove());
  pasajeros.forEach((pasajero) => crearFilaPasajero(pasajero, false));
  document.querySelector('[data-paste-passengers]').value = '';
  limpiarMensajeSolicitud();
}

function iniciarFormularioSolicitud() {
  if (!window.Rut || !window.apiFetch) {
    return;
  }

  const formulario = document.querySelector('[data-request-form]');
  const id = new URLSearchParams(window.location.search).get('id');
  const botonGuardar = document.querySelector('[data-save-draft]');
  const botonEnviar = document.querySelector('[data-send-request]');

  document.querySelector('[data-add-passenger]').addEventListener('click', () => {
    const filas = document.querySelectorAll('[data-passenger-row]');
    if (filas.length >= 36) {
      mostrarMensajeSolicitud('La nómina ya tiene 36 filas. Quite una fila para agregar otra.');
      return;
    }
    crearFilaPasajero();
    limpiarMensajeSolicitud();
  });

  document.querySelector('[data-import-passengers]').addEventListener('click', importarPasajeros);

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limpiarMensajeSolicitud();
    const accion = evento.submitter && evento.submitter.dataset.action
      ? evento.submitter.dataset.action
      : 'guardar';
    const datos = datosDelViaje();

    if (accion === 'enviar') {
      const error = validarParaEnviar(datos);
      if (error) {
        mostrarMensajeSolicitud(error);
        const control = error.startsWith('Ingrese el destino')
          ? document.querySelector('[name="destino"]')
          : error.startsWith('Seleccione la fecha') || error.startsWith('La fecha')
            ? document.querySelector('[name="fecha_salida"]')
            : error.startsWith('Ingrese la hora')
              ? document.querySelector(!datos.hora_salida ? '[name="hora_salida"]' : '[name="hora_regreso"]')
              : error.startsWith('Seleccione el motivo')
                ? document.querySelector('[name="motivo"]')
                : error.startsWith('Ingrese el nombre')
                  ? Array.from(document.querySelectorAll('[data-passenger-row]'))
                    .find((fila) => (
                      fila.querySelector('[data-passenger-rut]').value.trim()
                      && !fila.querySelector('[data-passenger-name]').value.trim()
                    ))
                    ?.querySelector('[data-passenger-name]')
                  : document.querySelector('[data-passenger-rut][aria-invalid="true"]');
        if (control) {
          control.focus();
        }
        return;
      }
    }

    botonGuardar.disabled = true;
    botonEnviar.disabled = true;

    try {
      if (accion === 'enviar') {
        await enviarSolicitud(datos);
      } else {
        await guardarBorrador(datos);
      }
    } catch (error) {
      console.error('No fue posible guardar la solicitud.', error);
      mostrarMensajeSolicitud('No fue posible guardar los cambios. Inténtelo nuevamente.');
    } finally {
      botonGuardar.disabled = solicitudEnviada;
      botonEnviar.disabled = solicitudEnviada;
      actualizarNómina();
    }
  });

  if (id) {
    formulario.setAttribute('aria-busy', 'true');
    formulario.querySelectorAll('input, select, textarea, button').forEach((control) => {
      control.disabled = true;
    });
    mostrarMensajeSolicitud('Cargando el borrador...');
    cargarBorrador(id).then((cargado) => {
      formulario.setAttribute('aria-busy', 'false');
      if (cargado) {
        formulario.querySelectorAll('input, select, textarea, button').forEach((control) => {
          control.disabled = false;
        });
        actualizarNómina();
      }
    }).catch((error) => {
      console.error('No fue posible cargar el borrador.', error);
      formulario.setAttribute('aria-busy', 'false');
      mostrarMensajeSolicitud('No fue posible cargar el borrador. Recargue la página e inténtelo nuevamente.');
    });
  } else {
    crearFilaPasajero();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarFormularioSolicitud);
} else {
  iniciarFormularioSolicitud();
}
