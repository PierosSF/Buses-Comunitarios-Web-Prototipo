# Instrucciones del repositorio: Plataforma de Buses Comunitarios (Padre Las Casas)

Proyecto académico (Santo Tomás IP). Prototipo funcional de una subpágina de la Municipalidad de Padre Las Casas para postular, asignar y autorizar buses comunitarios. El contexto completo está en docs/contexto-proyecto.txt: léelo antes de generar código.

## Stack (no cambiar)
- Frontend: HTML5, CSS3 y JavaScript vanilla. Sin frameworks ni build. Varias páginas HTML.
- Backend: Node.js 20 + Express. Sesiones con express-session. Contraseñas con bcryptjs.
- Base de datos: MySQL de XAMPP (localhost:3306, usuario root sin clave) con mysql2/promise.
- Todo corre local: `npm start` sirve la API y la carpeta public/ en http://localhost:3000.

## Estructura
```
buses-comunitarios/
├── .github/copilot-instructions.md
├── docs/                  contexto-proyecto.txt, prototipo-original/
├── database/              schema.sql, seed.sql
├── server/                app.js, db.js, routes/, middleware/, utils/
├── public/
│   ├── css/               base.css, layout.css, componentes.css
│   ├── js/                layout.js, api.js, rut.js, guard.js, y un js por página
│   ├── img/               logos (los coloca el equipo)
│   ├── partials/          header.html, footer.html
│   ├── login.html, index.html
│   ├── dirigente/         solicitudes.html, nueva-solicitud.html, solicitud.html
│   ├── dideco/            bandeja.html, calendario.html, solicitud.html
│   └── admin/             decretos.html, decreto.html
├── .env.example, package.json, README.md
```

## Convenciones
- Comentarios y textos de interfaz en español de Chile, tratando de "usted".
- Respuestas de la API: `{ ok: true, data }` o `{ ok: false, error: "mensaje claro" }`.
- Validar siempre en el servidor. La validación del cliente es solo ayuda al usuario.
- SQL siempre parametrizado (`?`). Nunca concatenar texto del usuario en una consulta.
- Mostrar datos en el DOM con `textContent`, no con `innerHTML`.
- Autorización por rol y por pertenencia: un dirigente solo ve las solicitudes de su organización.
- RUT: guardar normalizado (sin puntos, con guion). Mostrar formateado (12.345.678-5). Validar con módulo 11 (mismo algoritmo en server/utils/rut.js y public/js/rut.js).
- Fechas en la BD como DATE/TIME; mostrar en formato dd-mm-aaaa.

## Diseño (subpágina del sitio municipal)
Debe verse como parte de https://www.padrelascasas.cl: mismo header, footer y colores. Valores aproximados tomados de capturas; el equipo los verifica con DevTools y los ajusta en base.css:
```
--plc-azul-barra:   #0A4B9C   barra superior de enlaces
--plc-azul:         #0560C1   barra principal, botones primarios
--plc-verde:        #3F9B2E   franja verde, acciones positivas
--plc-gris-footer:  #2B2B2B   fondo del footer
--plc-celeste:      #3BB8C9   enlaces y detalles en el footer
--bg: #F6F6F4  --surf: #FFFFFF  --ink: #232629  --mute: #62676B  --line: #E0E0DD
--ok / --warn / --err con su versión -soft (verde, ámbar, rojo apagados)
```
- Contenido de la página en tonos neutros (fondo claro, tarjetas blancas) para no cargar la vista. Los colores municipales van en header, footer, botones principales y estados.
- Tipografía: sans-serif legible; títulos del menú en mayúsculas y negrita, como el sitio municipal. Tamaños en rem, nunca en px, para que la lupa funcione.
- Usuarios con poca experiencia digital: botones grandes (mín. 48px), textos simples, errores que explican cómo corregir.
- Accesibilidad: contraste AA, foco visible, etiquetas en todos los campos, navegación con teclado, `aria-live` en mensajes.
- Lupa de accesibilidad en el header: A−, A, A+ y contraste alto; escala 100%, 112,5%, 125%, 150%; se guarda en localStorage (`plc-fontscale`).

## Reglas de negocio (resumen)
1. Máximo 36 pasajeros por solicitud y no más que los asientos del bus asignado.
2. Todo RUT debe ser válido (módulo 11) y no repetirse dentro de la misma solicitud.
3. Un bus no puede asignarse a dos solicitudes en la misma fecha (verificar en el servidor, dentro de una transacción).
4. No se puede enviar una solicitud con fecha de salida pasada.
5. El decreto (DCV) solo se firma si la solicitud tiene bus asignado. Se advierte si faltan menos de 48 horas para la salida.
6. Cada cambio de estado se guarda en historial_estados y genera una notificación.
