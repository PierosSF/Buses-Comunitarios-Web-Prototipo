'use strict';

const escalasDeTexto = [100, 112.5, 125, 150];
const claveEscala = 'plc-fontscale';
const claveContraste = 'plc-high-contrast';

function copiarNodosParciales(contenedor, contenido) {
  const documentoParcial = new DOMParser().parseFromString(contenido, 'text/html');
  const nodos = Array.from(documentoParcial.body.childNodes)
    .map((nodo) => document.importNode(nodo, true));

  if (nodos.length === 0) {
    throw new Error('El parcial recibido no contiene elementos.');
  }

  contenedor.replaceChildren(...nodos);
  contenedor.setAttribute('aria-busy', 'false');
}

async function cargarParcial(selector, ruta, mensajeError) {
  const contenedor = document.querySelector(selector);

  if (!contenedor) {
    return;
  }

  try {
    const respuesta = await fetch(ruta);

    if (!respuesta.ok) {
      throw new Error(`No se pudo cargar ${ruta}: ${respuesta.status}`);
    }

    copiarNodosParciales(contenedor, await respuesta.text());
  } catch (error) {
    console.error(error);
    contenedor.textContent = mensajeError;
    contenedor.setAttribute('aria-busy', 'false');
  }
}

function leerPreferencia(clave) {
  try {
    return window.localStorage.getItem(clave);
  } catch (error) {
    console.error(`No se pudo leer la preferencia ${clave}.`, error);
    return null;
  }
}

function guardarPreferencia(clave, valor, estado) {
  try {
    window.localStorage.setItem(clave, valor);
    return true;
  } catch (error) {
    console.error(`No se pudo guardar la preferencia ${clave}.`, error);
    estado.textContent = 'No se pudo guardar esta preferencia en este navegador.';
    return false;
  }
}

function prepararAccesibilidad() {
  const botonAbrir = document.querySelector('[data-accessibility-toggle]');
  const panel = document.querySelector('[data-accessibility-panel]');

  if (!botonAbrir || !panel) {
    return;
  }

  const estado = panel.querySelector('[data-accessibility-status]');
  const escalaGuardada = Number(leerPreferencia(claveEscala));
  let escalaActual = escalasDeTexto.includes(escalaGuardada) ? escalaGuardada : 100;

  function aplicarEscala(escala, guardar) {
    escalaActual = escala;
    document.documentElement.style.fontSize = `${escalaActual}%`;
    estado.textContent = `Tamaño del texto: ${escalaActual}%.`;

    if (guardar) {
      guardarPreferencia(claveEscala, String(escalaActual), estado);
    }
  }

  aplicarEscala(escalaActual, false);

  const contrasteGuardado = leerPreferencia(claveContraste) === 'true';
  const botonContraste = panel.querySelector('[data-high-contrast]');

  function aplicarContraste(activar, guardar) {
    document.documentElement.classList.toggle('high-contrast', activar);
    botonContraste.setAttribute('aria-pressed', String(activar));

    if (guardar) {
      estado.textContent = activar ? 'Contraste alto activado.' : 'Contraste alto desactivado.';
      guardarPreferencia(claveContraste, String(activar), estado);
    }
  }

  aplicarContraste(contrasteGuardado, false);

  function posicionarPanel() {
    const rectangulo = botonAbrir.getBoundingClientRect();
    const encabezado = document.querySelector('.municipal-header');
    const rectanguloEncabezado = encabezado
      ? encabezado.getBoundingClientRect()
      : { top: 0, right: window.innerWidth };
    const margen = 8;
    panel.style.top = `${rectangulo.bottom - rectanguloEncabezado.top + margen}px`;
    panel.style.right = `${Math.max(margen, rectanguloEncabezado.right - rectangulo.right)}px`;
  }

  function cerrarAccesibilidad(devolverFoco) {
    panel.hidden = true;
    botonAbrir.setAttribute('aria-expanded', 'false');
    botonAbrir.setAttribute('aria-label', 'Abrir opciones de accesibilidad');
    if (devolverFoco) {
      botonAbrir.focus();
    }
  }

  botonAbrir.addEventListener('click', () => {
    const estaAbierto = botonAbrir.getAttribute('aria-expanded') === 'true';
    if (estaAbierto) {
      cerrarAccesibilidad(true);
      return;
    }

    botonAbrir.setAttribute('aria-expanded', 'true');
    botonAbrir.setAttribute('aria-label', 'Cerrar opciones de accesibilidad');
    posicionarPanel();
    panel.hidden = false;
    window.requestAnimationFrame(() => {
      panel.querySelector('[data-font-action="decrease"]').focus();
    });
  });

  panel.addEventListener('click', (evento) => {
    const boton = evento.target.closest('button');

    if (!boton || !panel.contains(boton)) {
      return;
    }

    const accion = boton.dataset.fontAction;

    if (accion === 'reset') {
      aplicarEscala(100, true);
    } else if (accion === 'increase' || accion === 'decrease') {
      const direccion = accion === 'increase' ? 1 : -1;
      const indiceActual = escalasDeTexto.indexOf(escalaActual);
      const indiceNuevo = Math.max(
        0,
        Math.min(escalasDeTexto.length - 1, indiceActual + direccion)
      );
      aplicarEscala(escalasDeTexto[indiceNuevo], true);
    } else if (boton.matches('[data-high-contrast]')) {
      aplicarContraste(boton.getAttribute('aria-pressed') !== 'true', true);
    }
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !panel.hidden) {
      cerrarAccesibilidad(true);
    }
  });

  document.addEventListener('pointerdown', (evento) => {
    if (!panel.hidden && !panel.contains(evento.target) && !botonAbrir.contains(evento.target)) {
      cerrarAccesibilidad(false);
    }
  });

  window.addEventListener('resize', () => {
    if (!panel.hidden) {
      posicionarPanel();
    }
  });
}

function marcarEnlaceActivo() {
  const seccionActual = document.body.dataset.navActive;

  if (!seccionActual) {
    return;
  }

  document.querySelectorAll('[data-nav]').forEach((enlace) => {
    const activo = enlace.dataset.nav === seccionActual;
    enlace.classList.toggle('is-active', activo);

    if (activo) {
      enlace.setAttribute('aria-current', 'page');
    } else {
      enlace.removeAttribute('aria-current');
    }
  });
}

function prepararMenuMovil() {
  const boton = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-primary-nav]');
  const etiqueta = document.querySelector('[data-menu-label]');

  if (!boton || !menu) {
    return;
  }

  function cerrarMenu() {
    menu.classList.remove('is-open');
    boton.setAttribute('aria-expanded', 'false');
    if (etiqueta) {
      etiqueta.textContent = 'Menú';
    }
  }

  boton.addEventListener('click', () => {
    const abrir = boton.getAttribute('aria-expanded') !== 'true';
    menu.classList.toggle('is-open', abrir);
    boton.setAttribute('aria-expanded', String(abrir));
    if (etiqueta) {
      etiqueta.textContent = abrir ? 'Cerrar' : 'Menú';
    }
  });

  menu.addEventListener('click', (evento) => {
    if (evento.target.closest('a')) {
      cerrarMenu();
    }
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && menu.classList.contains('is-open')) {
      cerrarMenu();
      boton.focus();
    }
  });
}

function mostrarUsuario(usuario) {
  const area = document.querySelector('[data-session-area]');
  const enlaceIngreso = document.querySelector('[data-sign-in]');

  if (!area || !enlaceIngreso) {
    return;
  }

  if (!usuario || typeof usuario.nombre !== 'string' || typeof usuario.rol !== 'string') {
    area.hidden = true;
    enlaceIngreso.hidden = false;
    return;
  }

  const nombresDeRol = {
    dirigente: 'Dirigente',
    dideco: 'DIDECO',
    administrador: 'Administrador municipal'
  };
  area.querySelector('[data-session-name]').textContent = usuario.nombre;
  area.querySelector('[data-session-role]').textContent =
    nombresDeRol[usuario.rol] || usuario.rol;
  area.hidden = false;
  enlaceIngreso.hidden = true;
}

function prepararAccionesDeSesion() {
  mostrarUsuario(window.plcUsuarioActual);

  document.addEventListener('plc:sesion-iniciada', (evento) => {
    mostrarUsuario(evento.detail);
  });

  document.addEventListener('plc:sesion-cerrada', () => {
    mostrarUsuario(null);
  });

  const botonCerrar = document.querySelector('[data-logout]');
  const botonNotificaciones = document.querySelector('[data-notifications]');
  const panelNotificaciones = document.querySelector('[data-notifications-panel]');
  const listaNotificaciones = document.querySelector('[data-notifications-list]');
  const vacioNotificaciones = document.querySelector('[data-notifications-empty]');
  const contadorNotificaciones = document.querySelector('[data-notification-count]');
  const estadoSesion = document.querySelector('[data-session-status]');

  if (botonCerrar) {
    botonCerrar.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('plc:solicitar-cierre-sesion'));
    });
  }

  document.addEventListener('plc:solicitar-cierre-sesion', async () => {
    if (!window.apiFetch || !botonCerrar || !estadoSesion) {
      return;
    }

    botonCerrar.disabled = true;
    estadoSesion.textContent = 'Cerrando su sesión...';
    estadoSesion.hidden = false;
    const respuesta = await window.apiFetch('/api/auth/logout', { method: 'POST' });
    botonCerrar.disabled = false;

    if (!respuesta.ok) {
      estadoSesion.textContent = `No se pudo cerrar la sesión. ${respuesta.error}`;
      return;
    }

    document.dispatchEvent(new CustomEvent('plc:sesion-cerrada'));
    window.location.replace('/login.html');
  });

  if (botonNotificaciones) {
    const enlaceSolicitud = (notificacion) => {
      const usuario = window.plcUsuarioActual;
      if (!usuario) {
        return null;
      }
      if (usuario.rol === 'dirigente' && notificacion.solicitud_id) {
        return `/dirigente/solicitud.html?id=${encodeURIComponent(notificacion.solicitud_id)}`;
      }
      if (usuario.rol === 'dideco' && notificacion.solicitud_id) {
        return `/dideco/solicitud.html?id=${encodeURIComponent(notificacion.solicitud_id)}`;
      }
      if (usuario.rol === 'administrador' && notificacion.decreto_id) {
        return `/admin/decreto.html?id=${encodeURIComponent(notificacion.decreto_id)}`;
      }
      return null;
    };

    const marcarLeida = async (notificacion, boton) => {
      if (!window.apiFetch || !notificacion || notificacion.leida) {
        return;
      }
      boton.disabled = true;
      const respuesta = await window.apiFetch(
        `/api/notificaciones/${encodeURIComponent(notificacion.id)}/leida`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      if (respuesta.ok) {
        await actualizarNotificaciones();
      } else {
        boton.disabled = false;
        boton.textContent = respuesta.error;
      }
    };

    const renderizarNotificaciones = (datos) => {
      const elementos = datos.notificaciones || [];
      contadorNotificaciones.hidden = datos.sin_leer === 0;
      contadorNotificaciones.textContent = datos.sin_leer > 99 ? '99+' : String(datos.sin_leer);
      botonNotificaciones.setAttribute(
        'aria-label',
        datos.sin_leer
          ? `Notificaciones, ${datos.sin_leer} sin leer`
          : 'Notificaciones'
      );
      listaNotificaciones.replaceChildren();
      vacioNotificaciones.hidden = elementos.length > 0;

      elementos.forEach((notificacion) => {
        const item = document.createElement('li');
        const mensaje = document.createElement('p');
        const acciones = document.createElement('div');
        const enlace = document.createElement('a');
        const marcar = document.createElement('button');
        item.className = `notification-item${notificacion.leida ? '' : ' is-unread'}`;
        mensaje.textContent = notificacion.mensaje;
        acciones.className = 'notification-actions';

        const destino = enlaceSolicitud(notificacion);
        if (destino) {
          enlace.href = destino;
          enlace.textContent = 'Ver solicitud';
          acciones.append(enlace);
        }
        if (!notificacion.leida) {
          marcar.type = 'button';
          marcar.textContent = 'Marcar como leída';
          marcar.addEventListener('click', () => marcarLeida(notificacion, marcar));
          acciones.append(marcar);
        }
        item.append(mensaje, acciones);
        listaNotificaciones.append(item);
      });
    };

    const actualizarNotificaciones = async () => {
      if (!window.apiFetch) {
        return;
      }
      const respuesta = await window.apiFetch('/api/notificaciones');
      if (respuesta.ok) {
        renderizarNotificaciones(respuesta.data);
      }
    };

    botonNotificaciones.addEventListener('click', async () => {
      const abrir = panelNotificaciones.hidden;
      panelNotificaciones.hidden = !abrir;
      botonNotificaciones.setAttribute('aria-expanded', String(abrir));
      if (abrir) {
        await actualizarNotificaciones();
      }
    });

    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape' && !panelNotificaciones.hidden) {
        panelNotificaciones.hidden = true;
        botonNotificaciones.setAttribute('aria-expanded', 'false');
        botonNotificaciones.focus();
      }
    });

    botonNotificaciones.setAttribute('aria-expanded', 'false');
    actualizarNotificaciones();
    window.setInterval(actualizarNotificaciones, 30000);
  }
}

async function prepararLayout() {
  await Promise.all([
    cargarParcial(
      '[data-layout-header]',
      '/partials/header.html',
      'No fue posible cargar el encabezado municipal.'
    ),
    cargarParcial(
      '[data-layout-footer]',
      '/partials/footer.html',
      'No fue posible cargar el pie de página municipal.'
    )
  ]);

  marcarEnlaceActivo();
  prepararAccesibilidad();
  prepararMenuMovil();
  prepararAccionesDeSesion();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', prepararLayout);
} else {
  prepararLayout();
}
