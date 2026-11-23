# Plataforma de Buses Comunitarios

Prototipo local para gestionar solicitudes y asignaciones de buses comunitarios de Padre Las Casas. La API y el sitio estático se sirven desde Node.js en `http://localhost:3000`.

## Requisitos

- Node.js 20 o superior y npm.
- XAMPP con MySQL.

## Puesta en marcha

1. Instale XAMPP y abra el Panel de Control de XAMPP.
2. Inicie el servicio **MySQL**.
3. Abra `http://localhost/phpmyadmin`.
4. Desde la carpeta del proyecto, instale las dependencias:

   ```powershell
   npm.cmd install
   ```

5. Copie `.env.example` como `.env` y ajuste la configuración si su instalación de MySQL es distinta. En PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

6. En phpMyAdmin, importe `database/schema.sql` y luego `database/seed.sql` en una base vacía. El esquema crea `buses_comunitarios`; las cuentas de demostración son `dirigente1@demo.local`, `dirigente2@demo.local`, `dideco@demo.local` y `administrador@demo.local`, todas con la clave `Demo1234`.

   Como alternativa, puede reconstruir automáticamente el esquema y cargar los datos desde PowerShell:

   ```powershell
   npm.cmd run seed
   ```

   **Advertencia:** este comando elimina completamente la base `buses_comunitarios` antes de crearla de nuevo. Úselo para reiniciar los datos; no lo ejecute si necesita conservar información.

7. Para generar otro hash de `Demo1234` y una lista de RUT ficticios válidos, ejecute:

   ```powershell
   node database/generar-hashes.js
   ```

   Copie el hash o los RUT necesarios en `database/seed.sql` antes de volver a importar los datos.

8. Inicie el servidor:

   ```powershell
   npm.cmd start
   ```

9. Abra `http://localhost:3000`. Para comprobar la conexión a MySQL, visite `http://localhost:3000/api/salud`.

El comando `npm.cmd run dev` inicia el servidor con nodemon durante el desarrollo en PowerShell. El valor de `SESSION_SECRET` incluido en `.env.example` es solo para desarrollo local; cámbielo antes de usar el sistema en otro entorno.

## Acceso de demostración

Abra `http://localhost:3000/login.html`. Las cuatro cuentas incluidas en `database/seed.sql` usan la clave común `Demo1234`:

| Perfil | RUT |
| --- | --- |
| Dirigente 1 | `99999980-8` |
| Dirigente 2 | `99999981-6` |
| DIDECO | `99999982-4` |
| Administrador municipal | `99999983-2` |

Al iniciar sesión, la portada lleva a cada perfil a su página inicial.

## Módulo del dirigente

Con una cuenta de dirigente, abra **Nueva solicitud** para completar los datos del viaje y la nómina. Puede guardar un borrador incompleto y retomarlo desde **Mis solicitudes**. Antes de enviarlo, el sistema exige los datos del viaje, una fecha futura y entre 1 y 36 pasajeros con RUT válidos y no repetidos.

En cada tarjeta puede revisar el avance y abrir el detalle. Cuando el decreto esté firmado, el detalle permite imprimirlo o guardarlo como PDF desde el navegador.

Si ya tenía una base creada antes de este módulo, ejecute `database/schema.sql` en phpMyAdmin para habilitar borradores incompletos y la secuencia de folios. Esta actualización no borra los registros; no ejecute `npm.cmd run seed` salvo que quiera recrear toda la base.

## Módulo DIDECO

Inicie sesión con `99999982-4` y la clave `Demo1234`. En **Solicitudes recibidas** puede filtrar por estado o buscar por folio, organización, dirigente o destino. Al abrir una solicitud enviada, pásela a revisión para habilitar la asignación del bus, devolución o rechazo. La devolución requiere un comentario y permite que el dirigente corrija y reenvíe la solicitud; el rechazo también requiere un comentario.

En **Calendario de flota**, avance a la semana que contiene las solicitudes de demostración, creadas para `CURDATE() + INTERVAL 10 DAY`. Los folios `2026-0412` y `2026-0415` compiten por esa fecha: los buses 1 y 2 ya están ocupados, por lo que solo queda libre el bus 3. El calendario resalta el choque y muestra la sugerencia. Puede ver el conflicto sin asignar un bus; no es necesario recrear la base.

La columna `estado` agrega el valor `devuelta`. Si su base ya existía, vuelva a ejecutar `database/schema.sql` para aplicar la ampliación del ENUM y crear la secuencia anual de decretos; la operación conserva los registros.

## Módulo del Administrador Municipal

Inicie sesión con `99999983-2` y la clave `Demo1234`. En **Decretos por visar** encontrará el decreto pendiente de la solicitud `2026-0409`. Abra el expediente para revisar los RUT, la capacidad y disponibilidad del bus, el motivo y el plazo antes de la salida.

El botón **Firmar y emitir** solicita confirmación y genera un número correlativo `DCV N° n/AAAA`, registra al firmante, la fecha y un hash SHA-256 del contenido, el firmante y la fecha. La firma de este prototipo es simulada y no tiene validez legal. Puede imprimir el documento firmado; el hash y la fecha de firma aparecen al pie.

Para devolver un decreto, escriba una observación obligatoria. La solicitud volverá a revisión de DIDECO, se liberará el bus y DIDECO podrá asignarlo nuevamente. Si ya tenía una base creada, importe otra vez `database/schema.sql` para agregar `secuencias_decretos`; no es necesario recrear ni sembrar la base.
