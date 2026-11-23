const path = require('path');
const fs = require('fs/promises');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const nombreBase = 'buses_comunitarios';

async function recrearBase() {
  if (process.env.DB_NAME !== nombreBase) {
    throw new Error(`Configure DB_NAME=${nombreBase} en .env antes de ejecutar este comando.`);
  }

  if (!process.env.DB_HOST || !process.env.DB_USER || process.env.DB_PASSWORD === undefined) {
    throw new Error('Configure DB_HOST, DB_USER y DB_PASSWORD en .env antes de ejecutar este comando.');
  }

  let conexion;

  try {
    conexion = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true
    });

    const esquema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
    const datos = await fs.readFile(path.join(__dirname, 'seed.sql'), 'utf8');

    console.log(`Se eliminará y recreará la base ${nombreBase}.`);
    await conexion.query(`DROP DATABASE IF EXISTS \`${nombreBase}\``);
    await conexion.query(esquema);
    await conexion.query(datos);
    console.log('Base de datos y datos de demostración creados correctamente.');
  } finally {
    if (conexion) {
      await conexion.end();
    }
  }
}

recrearBase().catch((error) => {
  console.error('No fue posible recrear la base de datos:', error);
  process.exitCode = 1;
});
