'use strict';

function iniciarFormularioLogin() {
  const formulario = document.querySelector('[data-login-form]');

  if (!formulario || !window.Rut || !window.apiFetch) {
    return;
  }

  const campoRut = formulario.querySelector('[name="rut"]');
  const campoClave = formulario.querySelector('[name="clave"]');
  const mensaje = document.querySelector('[data-login-message]');
  const botonEnviar = formulario.querySelector('[type="submit"]');

  function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.dataset.tipo = tipo || 'error';
    mensaje.hidden = false;
  }

  function limpiarMensaje() {
    mensaje.textContent = '';
    mensaje.hidden = true;
    delete mensaje.dataset.tipo;
  }

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
    campoRut.setAttribute('aria-invalid', 'false');
    limpiarMensaje();
  });

  campoRut.addEventListener('blur', () => {
    campoRut.value = window.Rut.formatearRut(campoRut.value);
  });

  campoClave.addEventListener('input', limpiarMensaje);

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limpiarMensaje();

    const rut = window.Rut.limpiarRut(campoRut.value);
    const clave = campoClave.value;

    if (!rut) {
      campoRut.setAttribute('aria-invalid', 'true');
      mostrarMensaje('Ingrese su RUT para continuar.');
      campoRut.focus();
      return;
    }

    if (!window.Rut.validarRut(rut)) {
      campoRut.setAttribute('aria-invalid', 'true');
      mostrarMensaje('Revise el RUT. Ingrese un número y un dígito verificador válidos.');
      campoRut.focus();
      return;
    }

    campoRut.setAttribute('aria-invalid', 'false');

    if (!clave) {
      mostrarMensaje('Ingrese su clave para continuar.');
      campoClave.focus();
      return;
    }

    botonEnviar.disabled = true;
    botonEnviar.textContent = 'Ingresando…';

    const respuesta = await window.apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ rut, clave }),
      redirectOnUnauthorized: false
    });

    botonEnviar.disabled = false;
    botonEnviar.textContent = 'Ingresar';

    if (!respuesta.ok) {
      mostrarMensaje(
        respuesta.status === 401
          ? 'El RUT o la clave no son correctos. Revise los datos e inténtelo nuevamente.'
          : respuesta.error
      );
      return;
    }

    window.plcUsuarioActual = respuesta.data;
    document.dispatchEvent(new CustomEvent('plc:sesion-iniciada', {
      detail: respuesta.data
    }));
    window.location.replace('/index.html');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarFormularioLogin);
} else {
  iniciarFormularioLogin();
}
