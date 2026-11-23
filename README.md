# Plataforma de Buses Comunitarios

Prototipo local para gestionar solicitudes y asignaciones de buses comunitarios de Padre Las Casas. La API y el sitio estático se sirven desde Node.js en `http://localhost:3000`.

## Requisitos

- Node.js 20 o superior y npm.
- XAMPP con MySQL.

## Puesta en marcha

1. Instale XAMPP y abra el Panel de Control de XAMPP.
2. Inicie el servicio **MySQL**.
3. Abra `http://localhost/phpmyadmin`.
4. En phpMyAdmin, importe `database/schema.sql` y luego `database/seed.sql`. El esquema crea la base `buses_comunitarios`.
5. Desde la carpeta del proyecto, instale las dependencias:

   ```powershell
   npm.cmd install
   ```

6. Copie `.env.example` como `.env` y ajuste la configuración si su instalación de MySQL es distinta. En PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

7. Inicie el servidor:

   ```powershell
   npm.cmd start
   ```

8. Abra `http://localhost:3000`. Para comprobar la conexión a MySQL, visite `http://localhost:3000/api/salud`.

El comando `npm.cmd run dev` inicia el servidor con nodemon durante el desarrollo en PowerShell. El valor de `SESSION_SECRET` incluido en `.env.example` es solo para desarrollo local; cámbielo antes de usar el sistema en otro entorno.
