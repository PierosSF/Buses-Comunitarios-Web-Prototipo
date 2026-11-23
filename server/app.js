const path = require('path');
const express = require('express');
const session = require('express-session');
const dotenv = require('dotenv');
const rutasSalud = require('./routes/salud');
const rutasAuth = require('./routes/auth');
const rutasSolicitudes = require('./routes/solicitudes');
const rutasDideco = require('./routes/dideco');
const rutasAdmin = require('./routes/admin');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const secretoSesion = process.env.SESSION_SECRET;

if (!secretoSesion) {
  throw new Error('Falta SESSION_SECRET. Copie .env.example a .env y configure la sesión.');
}

const app = express();

app.use(express.json({ limit: '10kb' }));
app.use(session({
  secret: secretoSesion,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/auth', rutasAuth);
app.use('/api/solicitudes', rutasSolicitudes);
app.use('/api/dideco', rutasDideco);
app.use('/api/admin', rutasAdmin);
app.use('/api', rutasSalud);

app.use('/api', (req, res, next) => {
  const error = new Error('Ruta de API no encontrada.');
  error.status = 404;
  next(error);
});

app.use((error, req, res, next) => {
  const status = error.status || 500;

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    ok: false,
    error: error.publicMessage || (status >= 500
      ? 'Ocurrió un error interno del servidor.'
      : error.message)
  });
});

const puerto = Number(process.env.PORT) || 3000;

app.listen(puerto, () => {
  console.log(`Servidor disponible en http://localhost:${puerto}`);
});
