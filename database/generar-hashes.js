const bcrypt = require('bcryptjs');

const cantidadRuts = 14;
const primerNumero = 99999980;

function calcularDigitoVerificador(numero) {
  const digitos = String(numero);
  let suma = 0;
  let factor = 2;

  for (let indice = digitos.length - 1; indice >= 0; indice -= 1) {
    suma += Number(digitos[indice]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }

  const resultado = 11 - (suma % 11);

  if (resultado === 11) {
    return '0';
  }

  if (resultado === 10) {
    return 'K';
  }

  return String(resultado);
}

async function main() {
  const hash = await bcrypt.hash('Demo1234', 10);
  const ruts = Array.from({ length: cantidadRuts }, (_, indice) => {
    const numero = primerNumero + indice;
    return `${numero}-${calcularDigitoVerificador(numero)}`;
  });

  console.log('Hash bcryptjs para la clave Demo1234:');
  console.log(hash);
  console.log('\nRUT ficticios válidos, normalizados y sin puntos:');
  ruts.forEach((rut, indice) => {
    console.log(`${indice + 1}. ${rut}`);
  });
}

main().catch((error) => {
  console.error('No fue posible generar el hash y los RUT:', error);
  process.exitCode = 1;
});
