'use strict';

async function apiFetch(url, opciones) {
  const ajustes = opciones || {};
  const redirigirSiNoAutorizado = ajustes.redirectOnUnauthorized !== false;
  const opcionesFetch = { ...ajustes };
  delete opcionesFetch.redirectOnUnauthorized;

  const encabezados = new Headers(opcionesFetch.headers || {});
  encabezados.set('Accept', 'application/json');

  if (opcionesFetch.body && !encabezados.has('Content-Type')) {
    encabezados.set('Content-Type', 'application/json');
  }

  try {
    const respuesta = await fetch(url, {
      ...opcionesFetch,
      headers: encabezados,
      credentials: 'same-origin'
    });
    let resultado;

    try {
      resultado = await respuesta.json();
    } catch (error) {
      console.error('La API devolvió una respuesta que no es JSON válido.', error);
      return {
        ok: false,
        error: 'El servidor devolvió una respuesta no válida.',
        status: respuesta.status
      };
    }

    if (respuesta.status === 401 && redirigirSiNoAutorizado && window.location.pathname !== '/login.html') {
      window.location.replace('/login.html');
    }

    if (!respuesta.ok || !resultado || resultado.ok !== true) {
      return {
        ok: false,
        error: resultado && typeof resultado.error === 'string'
          ? resultado.error
          : 'No fue posible completar la solicitud.',
        status: respuesta.status
      };
    }

    return {
      ok: true,
      data: resultado.data,
      status: respuesta.status
    };
  } catch (error) {
    console.error('No fue posible comunicarse con la API.', error);
    return {
      ok: false,
      error: 'No fue posible conectar con el sistema. Revise su conexión e inténtelo nuevamente.',
      status: 0
    };
  }
}

window.apiFetch = apiFetch;
