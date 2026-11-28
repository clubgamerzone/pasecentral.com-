# Inicio del comprador y carrusel personal

Entrega local,27nov2026. El propietario pidió mostrar directamente las boletas al comprador, con recorrido horizontal, una interfaz más amable y acceso a sus entradas propias para administradores/cajeros/personal.

## Cómo encontrarlo

- Comprador sin permisos operativos: después de iniciar sesión entra a `/account/tickets`. Visitar `/` con sesión también retoma la pantalla que corresponde a sus permisos.
- Administrador global/gestor de eventos: conserva `/admin`; taquilla conserva `/box-office`; acceso conserva `/access`.
- Si el personal posee entradas, la cabecera muestra **Ver mis tiquetes (N)**. El conteo incluye únicamente `owner_user_id` de su cuenta, no entradas vendidas a clientes.
- Invitaciones pendientes y recuperación conservan prioridad sobre el inicio por rol. La confirmación de cuenta mantiene el recorrido anterior hacia perfil/invitación; no se conceden roles por el redireccionamiento.

## Interfaz del comprador

Bienvenida personal, cantidad de entradas vigentes y acción Explorar eventos; tarjetas horizontales con estado, evento, fecha/lugar, localidad y consecutivo. QR grande de la boleta activa para presentar en acceso; portada del evento cuando existe. Se puede deslizar con el dedo o usar botones Anterior/Siguiente. Contador sincronizado con la tarjeta; desplazamiento contenido sin desbordar la página móvil.

Se priorizan vigentes y compras recientes. Las utilizadas/anuladas o con transferencia pendiente muestran su estado sin QR de ingreso. No se borra su historial. Regalos/transferencias se conservan debajo y su panel se omite cuando no hay entregas; selección/transferencia e historial de compras mantienen los flujos existentes. Si no hay entradas, aparece una invitación a explorar eventos.

El enlace **Ver entrada** abre `/tickets/[orderId]?mine=1`, también para personal. Descarga/PDF usa el filtro de titularidad; no incorpora las demás boletas de la orden que el usuario solo podría consultar por su rol operativo.

## Seguridad y rendimiento

La vista previa envía `owner_only=true` y `preview_ticket_id` a `/api/tickets`. El servidor utiliza `ticketDocument(..., ownerOnly=true)`, sin heredar privilegios del personal; solo encuentra la entrada si pertenece al titular y no está retenida por una transferencia pendiente. Devuelve únicamente ID y PNG del QR, sin token en texto, enlaces de entrega o PDF completo. No agrega QR al estado general ni los registra en logs.

Se carga la tarjeta seleccionada y se conserva una caché de hasta ocho QR vistos en memoria. No hay descarga inicial de todos los PDF ni de todos los QR. Un nuevo estado de la cuenta invalida la caché anterior; cambiar de cuenta/desmontar la vista elimina la caché del componente. Se cancela la solicitud de lectura al cambiar de tarjeta; cancelar una vista previa no cambia una venta o un ingreso. Los documentos completos mantienen sus controles y enlaces autorizados existentes.

Para eventos históricos no incluidos en el catálogo, `state.ts` añade título/fecha/recinto al registro de las entradas ya autorizadas, sin ampliar las filas visibles ni devolver credenciales.

## Código

- `src/lib/landing-page.ts`: destino por permisos efectivos, sin depender del nombre del botón demo.
- `src/components/app.tsx`: login/raíz, acceso personal del personal y cabecera de comprador.
- `src/components/ticket-wallet.tsx`: bienvenida, orden de entradas, carrusel y paneles inferiores.
- `src/components/ticket-carousel.tsx`: desplazamiento, navegación accesible, QR activo, caché y estados.
- `src/app/api/tickets/route.ts`: vista previa individual autorizada y opción de documento propio.
- `src/components/buyer.tsx`: modo `mine=1` en pantalla/descarga/PDF compartido.
- `src/lib/state.ts`: metadatos de evento para entradas ya autorizadas.
- `src/app/globals.css`: diseño y ancho móvil; cabecera del personal con clase explícita, sin depender de `:has`.

## Pruebas y evidencia

`tests/e2e/wallet.spec.ts`: comprador entra al wallet, compra tres entradas en demo, cambia de tarjeta en móvil, QR correcto/contador, sin desbordamiento, vista propia; personal con entradas propias y acceso visible; rechazo403 a una vista previa de boleta ajena incluso para administrador; respuesta sin credencial/enlace en texto; destinos de organizador, taquilla y acceso.

El test normaliza su identidad demo a comprador antes de probar ese caso: la prueba de invitaciones anterior puede promover esa misma cuenta a administrador. La aplicación siempre respeta el permiso real, no la etiqueta original Comprador demo.

Lint, tipos, build y147pruebas de reglas aprobados. Dos recorridos nuevos de wallet aprobados tras la última revisión visual. La regresión33recorridos tuvo30aprobados y tres incidencias: conexión perdida en Taquilla, carga de pantalla no completada en UI y fixture de comprador previamente promovido. Se corrigió la preparación del fixture; los cuatro recorridos pertinentes (Taquilla, UI y ambos wallet) pasaron al repetirlos aislados. No afirmar un único pase limpio de33. Evidencia privada en `.local/wallet-*.log` y `test-results/wallet-home-mobile.png`, `wallet-mobile.png`, `wallet-staff-desktop.png`. Las capturas contienen QR ficticios y permanecen fuera de Git.

La captura de página completa de Chromium reposicionaba el contenedor con scroll-snap al expandir el viewport. Para revisar el desplazamiento real se captura el carrusel sin redimensionar la página y se comprueba que conserve Entrada2 después de la captura. No es necesario cambiar el scroll del producto para obtener una captura larga.

Pruebas en copia privada aislada con PGlite y pagos demo, sin compras/emails cloud ni cambios de producción. Ejecución privada usada: `npx playwright test --config .local/playwright-web-regression.config.ts wallet.spec.ts`. El servidor LAN permanece en `http://192.168.1.15:3000`; iniciar sesión para ver datos propios. Sin push/despliegue de esta entrega; producción conserva el lanzamiento Retro Fest anterior. APK continúa en pausa.
