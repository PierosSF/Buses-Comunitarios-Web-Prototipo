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
