# Pruebas manuales P9

## Preparación

1. Inicie MySQL desde XAMPP.
2. Reinicie los datos con `npm.cmd run seed` si necesita un estado conocido.
3. Inicie el servidor con `npm.cmd start`.
4. Abra `http://localhost:3000/login.html`.
5. Use la clave común `Demo1234` para todas las cuentas.

## Acceso por perfil

| Cuenta | RUT | Resultado esperado |
| --- | --- | --- |
| Dirigente 1 | `99999980-8` | Entra en Mis solicitudes y solo ve la organización 1. |
| Dirigente 2 | `99999981-6` | Entra en Mis solicitudes y solo ve la organización 2. |
| DIDECO | `99999982-4` | Entra en Solicitudes recibidas. |
| Administrador | `99999983-2` | Entra en Decretos por visar. |

## Escenarios

### 1. Dirigente crea una solicitud con RUT inválido

1. Inicie con el dirigente 1.
2. Abra Nueva solicitud.
3. Complete destino, fecha futura, horas y motivo.
4. Agregue un pasajero con nombre y RUT `11.111.111-1`.
5. Pulse Enviar.

Resultado: el sistema bloquea el envío y explica que el RUT no es válido. No aparece una solicitud enviada.

### 2. Dirigente crea y envía una solicitud válida

1. Inicie con el dirigente 1.
2. Abra Nueva solicitud.
3. Complete los datos de viaje.
4. Agregue al menos un pasajero con RUT válido, por ejemplo `99999988-3`.
5. Pulse Guardar borrador y después Enviar.

Resultado: el folio queda creado, cambia a Enviada y DIDECO recibe una notificación. El pasajero puede revisarse con el RUT formateado.

### 3. DIDECO asigna un bus

1. Cierre la sesión y entre como DIDECO.
2. Abra Solicitudes recibidas y seleccione una solicitud enviada.
3. Pulse Iniciar revisión.
4. Seleccione un bus con capacidad suficiente y pulse Asignar bus.

Resultado: la solicitud cambia a Bus asignado. Se crea el decreto pendiente y el dirigente recibe una notificación.

### 4. DIDECO intenta asignar un bus ocupado

1. Entre como DIDECO y abra la solicitud `2026-0412`.
2. Inicie la revisión si corresponde.
3. Intente asignar el Bus 1 o el Bus 2 en una fecha ocupada por otra solicitud.

Resultado: el sistema rechaza la asignación y explica que ese bus ya está ocupado ese día. No se modifica la solicitud.

### 5. DIDECO devuelve una solicitud

1. Abra una solicitud en revisión.
2. Escriba una observación clara en el campo obligatorio.
3. Pulse Devolver.

Resultado: la solicitud cambia a Devuelta para corregir. El dirigente puede corregirla y reenviarla.

### 6. DIDECO rechaza una solicitud

1. Abra otra solicitud en revisión.
2. Escriba el motivo obligatorio.
3. Pulse Rechazar.

Resultado: la solicitud cambia a Rechazada y el dirigente recibe el motivo en la notificación.

### 7. Administrador firma un decreto

1. Cierre la sesión y entre como Administrador.
2. Abra Decretos por visar.
3. Abra la solicitud `2026-0409`.
4. Revise pasajeros, bus y advertencia de plazo.
5. Pulse Firmar y emitir y confirme.

Resultado: se genera el número DCV, se registra la firma simulada y el dirigente y DIDECO reciben notificaciones.

### 8. Administrador devuelve un decreto

1. Abra un decreto pendiente.
2. Escriba una observación.
3. Pulse Devolver a DIDECO.

Resultado: el decreto vuelve a DIDECO, la solicitud vuelve a revisión y se libera el bus asignado.

### 9. Dirigente consulta e imprime el decreto firmado

1. Entre como dirigente 1.
2. Abra la solicitud `2026-0377`.
3. Revise el decreto firmado.
4. Pulse Imprimir decreto.
5. Seleccione Imprimir o Guardar como PDF.

Resultado: la impresión contiene el decreto y la nómina sin el encabezado, menú ni acciones.

### 10. Historial y notificaciones

1. Revise el historial en los tres detalles de solicitud.
2. Abra la campana del encabezado.
3. Marque una notificación como leída.

Resultado: el contador disminuye y el enlace abre la solicitud o decreto correspondiente.

### 11. Accesibilidad y lupa

1. En cada perfil, abra una pantalla con tablas y formularios.
2. Pulse Aa y pruebe A−, A, A+.
3. Active el tamaño 150% y contraste alto.
4. Cierre el panel con el botón, Esc y clic fuera.

Resultado: el panel no tapa el menú ni el teléfono; el foco vuelve al botón. Las tablas permiten desplazamiento interno y la página no tiene desbordamiento horizontal.

### 12. Responsividad

1. Redimensione el navegador a 375 px de ancho.
2. Revise login, listados, detalle, nueva solicitud, calendario y decreto.

Resultado: controles completos, tablas desplazables dentro de su contenedor y sin desbordamiento general de la página.

### 13. Control de pertenencia

1. Inicie como dirigente 1.
2. Intente abrir desde la barra de dirección una solicitud de la organización 2.

Resultado: el sistema rechaza el acceso y no muestra pasajeros ni datos ajenos.
