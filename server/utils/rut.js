'use strict';

function limpiarRut(rut) {
  if (typeof rut !== 'string') {
    return '';
  }

  const compacto = rut.trim().replace(/[.\s-]/g, '').toUpperCase();

  if (compacto.length < 2) {
    return compacto;
  }

  return `${compacto.slice(0, -1)}-${compacto.slice(-1)}`;
}

function agruparNumero(numero) {
  return numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatearRut(rut, parcial) {
  if (typeof rut !== 'string') {
    return '';
  }

  const valor = rut.trim();
  const compacto = valor.replace(/[.\s-]/g, '').toUpperCase();

  if (parcial && /-$/.test(valor)) {
    const numero = compacto;

    if (/^\d{1,8}$/.test(numero)) {
      return `${agruparNumero(numero)}-`;
    }
  }

  if (parcial && !valor.includes('-') && /^\d*$/.test(compacto) && compacto.length <= 8) {
    return agruparNumero(compacto);
  }

  const limpio = limpiarRut(rut);
  const separador = limpio.lastIndexOf('-');

  if (separador < 0) {
    return agruparNumero(limpio);
  }

  const numero = limpio.slice(0, separador);
  const verificador = limpio.slice(separador + 1);

  if (!/^\d+$/.test(numero)) {
    return `${numero}-${verificador}`;
  }

  return `${agruparNumero(numero)}-${verificador}`;
}

function validarRut(rut) {
  const limpio = limpiarRut(rut);
  const coincidencia = limpio.match(/^(\d{1,8})-([0-9K])$/);

  if (!coincidencia) {
    return false;
  }

  const numero = coincidencia[1];
  const verificadorRecibido = coincidencia[2];
  let suma = 0;
  let factor = 2;

  for (let indice = numero.length - 1; indice >= 0; indice -= 1) {
    suma += Number(numero[indice]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }

  const resultado = 11 - (suma % 11);
  const verificadorCalculado = resultado === 11
    ? '0'
    : resultado === 10
      ? 'K'
      : String(resultado);

  return verificadorRecibido === verificadorCalculado;
}

module.exports = {
  limpiarRut,
  formatearRut,
  validarRut
};
