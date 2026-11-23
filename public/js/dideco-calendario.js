'use strict';

let lunesCalendario;

function fechaLocalIso() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function moverFechaIso(fechaIso, dias) {
  const fecha = new Date(`${fechaIso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function lunesDeSemana(fechaIso) {
  const fecha = new Date(`${fechaIso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() - ((fecha.getUTCDay() + 6) % 7));
  return fecha.toISOString().slice(0, 10);
}

function etiquetaDiaCalendario(fechaIso) {
  const fecha = new Date(`${fechaIso}T00:00:00Z`);
  const dia = new Intl.DateTimeFormat('es-CL', {
    weekday: 'short',
    timeZone: 'UTC'
  }).format(fecha);
  return `${dia.charAt(0).toLocaleUpperCase('es-CL')}${dia.slice(1)} ${window.SolicitudesUI.formatearFecha(fechaIso)}`;
}

function crearEnlaceCalendario(solicitud, pendiente) {
  const enlace = document.createElement('a');
  enlace.className = `calendar-event estado-${solicitud.estado}`;
  enlace.href = `/dideco/solicitud.html?id=${encodeURIComponent(solicitud.id)}`;
  const folio = document.createElement('strong');
  folio.textContent = solicitud.folio;
  const destino = document.createElement('span');
  destino.textContent = solicitud.destino || 'Destino pendiente';
  enlace.append(folio, document.createElement('br'), destino);

  if (pendiente) {
    const organizacion = document.createElement('span');
    organizacion.className = 'calendar-suggestion';
    organizacion.textContent = solicitud.organizacion_nombre;
    enlace.append(document.createElement('br'), organizacion);
    const sugerido = document.createElement('span');
    sugerido.className = 'calendar-suggestion';
    sugerido.textContent = solicitud.bus_sugerido
      ? `Bus sugerido: ${solicitud.bus_sugerido.nombre}`
      : 'Sin bus libre con capacidad suficiente';
    enlace.append(sugerido);
  }
  return enlace;
}

function renderizarPendientes(datos) {
  const contenedor = document.querySelector('[data-pending-grid]');
  contenedor.replaceChildren();

  datos.pendientes_por_dia.forEach((dia) => {
    const tarjeta = document.createElement('article');
    const titulo = document.createElement('h3');
    tarjeta.className = `calendar-day-card${dia.conflicto ? ' is-conflict' : ''}`;
    titulo.textContent = etiquetaDiaCalendario(dia.fecha);
    tarjeta.append(titulo);

    if (dia.conflicto) {
      const choque = datos.choques.find((item) => item.fecha === dia.fecha);
      const alerta = document.createElement('p');
      alerta.className = 'calendar-conflict-message';
      alerta.textContent = choque
        ? `Choque: ${choque.solicitudes_pendientes.length} solicitudes y capacidad libre para ${choque.asignaciones_sugeridas.length}.`
        : 'Choque de fecha: hay más solicitudes que buses disponibles.';
      tarjeta.append(alerta);
    }

    if (dia.solicitudes.length === 0) {
      const vacio = document.createElement('span');
      vacio.textContent = 'Sin solicitudes pendientes';
      tarjeta.append(vacio);
    } else {
      dia.solicitudes.forEach((solicitud) => {
        tarjeta.append(crearEnlaceCalendario(solicitud, true));
      });
    }
    contenedor.append(tarjeta);
  });
}

function renderizarReservas(datos) {
  const encabezado = document.querySelector('[data-calendar-head]');
  const cuerpo = document.querySelector('[data-calendar-body]');
  encabezado.replaceChildren();
  cuerpo.replaceChildren();

  const filaEncabezado = document.createElement('tr');
  const tituloBus = document.createElement('th');
  tituloBus.scope = 'col';
  tituloBus.textContent = 'Bus';
  filaEncabezado.append(tituloBus);
  datos.dias.forEach((fecha) => {
    const celda = document.createElement('th');
    celda.scope = 'col';
    celda.textContent = etiquetaDiaCalendario(fecha);
    filaEncabezado.append(celda);
  });
  encabezado.append(filaEncabezado);

  if (datos.buses.length === 0) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 8;
    celda.textContent = 'No hay buses registrados para esta semana.';
    fila.append(celda);
    cuerpo.append(fila);
    return;
  }

  datos.buses.forEach((bus) => {
    const fila = document.createElement('tr');
    const nombre = document.createElement('th');
    nombre.scope = 'row';
    nombre.className = 'calendar-bus-label';
    nombre.textContent = `${bus.nombre} · ${bus.patente} · ${bus.asientos} asientos`;
    if (Number(bus.activo) !== 1) {
      const inactivo = document.createElement('span');
      inactivo.className = 'calendar-bus-inactive';
      inactivo.textContent = ' (inactivo; reserva existente)';
      nombre.append(inactivo);
    }
    fila.append(nombre);

    bus.dias.forEach((dia) => {
      const celda = document.createElement('td');
      celda.className = `calendar-cell${dia.conflicto ? ' is-conflict' : ''}`;
      if (dia.solicitudes.length === 0) {
        celda.textContent = 'Libre';
      } else {
        dia.solicitudes.forEach((solicitud) => {
          celda.append(crearEnlaceCalendario(solicitud, false));
        });
      }
      fila.append(celda);
    });
    cuerpo.append(fila);
  });
}

function renderizarSemana(datos) {
  const titulo = document.querySelector('[data-calendar-week]');
  titulo.textContent = `Semana ${window.SolicitudesUI.formatearFecha(datos.semana.desde)} al ${window.SolicitudesUI.formatearFecha(datos.semana.hasta)}`;
  lunesCalendario = datos.semana.desde;
  renderizarPendientes(datos);
  renderizarReservas(datos);

  const resumen = document.querySelector('[data-conflict-summary]');
  if (datos.choques.length === 0) {
    resumen.textContent = 'No se detectan choques de fecha en esta semana.';
    resumen.dataset.tipo = 'exito';
  } else {
    resumen.textContent = `Se detectaron ${datos.choques.length} fecha(s) con más solicitudes pendientes que buses libres con capacidad suficiente. Revise las tarjetas marcadas en rojo.`;
    resumen.dataset.tipo = 'error';
  }
  resumen.hidden = false;
}

async function cargarSemanaDideco(desde) {
  const mensaje = document.querySelector('[data-calendar-message]');
  const controles = Array.from(document.querySelectorAll(
    '[data-week-previous], [data-week-current], [data-week-next]'
  ));
  controles.forEach((control) => {
    control.disabled = true;
  });
  mensaje.textContent = 'Cargando el calendario...';
  mensaje.dataset.tipo = 'aviso';
  mensaje.hidden = false;

  const respuesta = await window.apiFetch(
    `/api/dideco/calendario?desde=${encodeURIComponent(desde)}`
  );
  if (!respuesta.ok) {
    mensaje.textContent = respuesta.error;
    mensaje.dataset.tipo = 'error';
    controles.forEach((control) => {
      control.disabled = false;
    });
    return;
  }

  renderizarSemana(respuesta.data);
  mensaje.hidden = true;
  delete mensaje.dataset.tipo;
  controles.forEach((control) => {
    control.disabled = false;
  });
}

function iniciarCalendarioDideco() {
  lunesCalendario = lunesDeSemana(fechaLocalIso());
  document.querySelector('[data-week-previous]').addEventListener('click', () => {
    cargarSemanaDideco(moverFechaIso(lunesCalendario, -7));
  });
  document.querySelector('[data-week-next]').addEventListener('click', () => {
    cargarSemanaDideco(moverFechaIso(lunesCalendario, 7));
  });
  document.querySelector('[data-week-current]').addEventListener('click', () => {
    cargarSemanaDideco(lunesDeSemana(fechaLocalIso()));
  });
  cargarSemanaDideco(lunesCalendario);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarCalendarioDideco);
} else {
  iniciarCalendarioDideco();
}
