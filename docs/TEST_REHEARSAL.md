# Ensayo de la demo y Honeywell

Guía preparada el 2026-10-13. No registra hardware ni pagos sandbox como aprobados: esos ensayos siguen pendientes. Usar exclusivamente eventos y operaciones ficticios identificados como DEMO.

## Preparación

- Aplicación: https://pasecentral-demo.vercel.app. El administrador ya logró iniciar sesión. Hosting, Supabase y entrega de correo al propietario están documentados en CLOUD_SETUP_2026-10-13.md y EMAIL_SETUP_2026-10-13.md.
- No hace falta otra cuenta de proveedor para probar el lector. Hace falta el Honeywell cargado, internet, navegador y otra pantalla o papel que muestre una entrada válida.
- Para separar permisos, crear cuentas propias de comprador, taquilla y acceso mediante el flujo de registro; confirmar sus correos. El administrador asigna personal en `/admin/events/[id]/staff` y revisa usuarios en `/admin/users`. No compartir la cuenta administrativa con operadores.
- Crear dos eventos DEMO con cupos pequeños, localidades y fases vigentes, y horario de admisión que incluya el momento del ensayo. Fechas de presentación: America/Bogota. No inventar la fecha del primer evento real.
- Se puede comenzar con la entrada de cortesía de prueba enviada por correo, si todavía está válida. Cada aceptación consume esa entrada; emitir otra cortesía autorizada para repetir pruebas. No reiniciar entradas usadas borrando registros.
- Confirmar modelo exacto del Honeywell, Android, navegador, número de lectores y puertas; para papel, modelo/conexión de impresora y sistema operativo de taquilla. Registrar estos datos y resultados del ensayo sin QR, enlaces privados ni credenciales.

## Honeywell EDA51: lector como teclado

Equipo confirmado por el propietario (2026-10-13): Honeywell EDA51, Android 8.1.0, navegador Google Chrome. Impresión aplazada por el propietario. Windows detectó el dispositivo como EDA51, clase WPD, estado OK. Existe Android SDK Platform Tools en el PC; `adb devices -l` no mostró dispositivos disponibles. La conexión USB actual no permitió consultar firmware, versión de Chrome ni configuración del scanner. No se modificaron ajustes del equipo ni se habilitó depuración.

Para este equipo comenzar con Wedge activado, método Standard/Normal si está disponible, prefijo vacío, QR activado, sufijo `\r` (barra invertida y r, sin comillas) y Wedge as keys `9,10,13`. Verificar primero que una lectura llena el campo y Enter envía el formulario; si falta Enter, usar el botón para separar la lectura de la configuración del sufijo. Android 8.1.0 por sí solo no identifica la revisión MR: Honeywell advierte que, al usar método Keyboard en Android 8 anterior a MR19, los caracteres incluidos en Wedge as keys pueden perderse. No aplicar ese método hasta comprobar revisión y necesidad.

La conexión al PC no es necesaria para operar: Chrome del EDA51 conecta directamente por HTTPS a la aplicación. Para diagnóstico adicional, el propietario puede consultar **Settings → About phone** (número de compilación) y la versión de Chrome. Si posteriormente desea diagnóstico USB con ADB, deberá habilitar depuración USB y aceptar la autorización RSA en el propio equipo; esto no es requisito para la prueba y todavía no se ha solicitado ni realizado.

### Incidencia de carga en el equipo (2026-10-13)

Para habilitar diagnóstico USB en Android 8.1: abrir Ajustes → Sistema → Acerca del teléfono/dispositivo; tocar Número de compilación (Build number) siete veces e introducir el PIN del equipo si lo solicita. Volver a Sistema → Opciones para desarrolladores y activar Depuración USB. Conectar/reconectar el cable con la pantalla desbloqueada y aceptar la autorización RSA «Permitir depuración USB» correspondiente al PC propio. La ubicación de Acerca del dispositivo puede estar directamente en Ajustes según firmware. Procedimiento proporcionado al propietario, todavía sin confirmación de ejecución. Fuente: [Android Developers](https://developer.android.com/studio/debug/dev-options).

El propietario informó que Chrome del EDA51 permanece en «Preparando tu espacio». La consulta pública `/api/state` desde el PC respondió HTTP 200, ambiente staging, demo deshabilitada y un evento publicado. Esto no prueba conectividad desde el dispositivo. `adb devices -l` seguía sin mostrar el equipo. En `App` la pantalla precede a la inicialización de JavaScript y carga de `/api/state`; aún no se capturó error del navegador ni se confirmó la causa.

Solicitados versión completa de Chrome y, opcionalmente, autorización de depuración USB en el equipo para diagnóstico. La guía incluida con Next.js 16.4 (`node_modules/next/dist/docs/03-architecture/supported-browsers.md`) indica Chrome 111+; Google identifica Chrome 138 como último compatible con Android 8/9. Android 8.1 por sí solo no impide una versión compatible, pero un Chrome antiguo puede bloquear la inicialización. Comprobar además desde el Honeywell si `/api/state` devuelve JSON o un error de conexión, sin compartir datos de sesión. No se cambiaron dependencias, firmware ni aplicación basándose en esta hipótesis.

Fuentes: [navegadores soportados por Next.js](https://nextjs.org/docs/architecture/supported-browsers) y [Google: Chrome en Android 8/9](https://support.google.com/chrome/thread/352616098/sunsetting-chrome-support-for-android-8-0-oreo-and-android-9-0-pie?hl=en-GB).

La pantalla implementada está en `src/components/operations.tsx`, componente `Access`, ruta `/access`. No requiere aplicación nativa de Pase Central ni modo offline.

1. Conectar el equipo a Wi-Fi o datos y comprobar que abre https://pasecentral-demo.vercel.app/login.
2. Iniciar sesión con el operador autorizado y abrir https://pasecentral-demo.vercel.app/access. Seleccionar el evento correcto, un identificador único (por ejemplo EDA51-01) y la puerta.
3. En el equipo revisar **Settings → Honeywell Settings → Scanning**, perfil del lector interno/default. Activar lectura QR en Symbology Settings y **Wedge** en Data Processing Settings. Los nombres y opciones varían con firmware/modelo; conservar la configuración previa antes de cambiarla.
4. El lector debe escribir el contenido completo en el campo enfocado y enviar **Enter** para validar. Para un EDA51 con método Standard/Normal, comprobar sufijo `\r` y que el carácter 13 se transmita como tecla mediante Wedge as keys. No añadir prefijos ni identificadores de simbología al token. No cambiar todas las opciones a Keyboard sin conocer la versión: Honeywell documenta diferencias en versiones antiguas de Android.
5. Tocar **Escanea el QR de la entrada** después de editar equipo o puerta. Mostrar el QR individual de una boleta en otro teléfono/computador y accionar el gatillo. La lectura correcta debe llenar el campo y producir la validación automáticamente; después de responder, la aplicación recupera el foco.
6. Si el texto llega pero no valida, pulsar **Validar entrada** para aislar la lectura del problema de Enter. Luego corregir sufijo/tecla. Si no llega texto, revisar foco, Wedge, permiso de QR y otras aplicaciones que puedan estar usando el scanner. Un pitido del lector solo confirma decodificación; autorizar exclusivamente con **Ingreso autorizado** en la aplicación.

El QR de ingreso es el de cada boleta; el consecutivo, serial y enlace para compartir no lo sustituyen. No copiar tokens a este documento ni al chat.

Fuentes oficiales: [manual EDA51, capítulo del lector y Data Processing Settings](https://prod-edam.honeywell.com/content/dam/honeywell-edam/sps/ppr/es-mx/public/products/mobile-computers/handheld-computers/eda51/documents/sps-ppr-eda51-a-en-ug.pdf?download=false) y [Honeywell: Wedge Method y diferencias por versión](https://sps-support.honeywell.com/s/article/Android-Data-Processing-Settings-Wedge-Method). Los ajustes se deben confirmar en el equipo real.

## Casos de acceso

Completar el resultado observado durante el ensayo; los resultados esperados siguientes no constituyen pruebas ejecutadas.

| Caso | Resultado esperado | Observado / fecha |
| --- | --- | --- |
| QR válido dentro del horario | Una aceptación; entrada pasa a usada | Pendiente |
| Volver a leer la misma boleta | Ya utilizada; no aumenta asistencia | Pendiente |
| Dos lectores simultáneos con el mismo QR | Solo uno acepta; el otro indica utilizada | Pendiente |
| Boleta de evento A con evento B activo | Rechazo por otro evento | Pendiente |
| Boleta anulada | Rechazo por anulación | Pendiente |
| QR ajeno a Pase Central | Entrada desconocida | Pendiente |
| Fuera del horario de admisión | Rechazo por horario | Pendiente |
| Operador sin asignación al evento | Sin permiso; no valida | Pendiente |
| Desactivar conexión e intentar validar | Error de red; nunca autorización | Pendiente |
| Restaurar red y repetir lectura fallida sin refrescar | Recupera respuesta usando el mismo request_id si quedó pendiente | Pendiente |
| Lectura de QR en pantalla y en papel | Contenido completo, Enter y foco funcionando | Pendiente |

El reintento conserva su identificador solamente en la página actual. Una recarga pierde ese identificador: revisar historial y supervisar la incidencia. Para simular una respuesta perdida después de aceptar se requiere un ensayo controlado adicional; desconectar antes del envío no demuestra ese caso. Con un solo equipo puede probarse duplicación secuencial, pero no homologar dos lectores físicos simultáneos.

Medir desde la lectura hasta el resultado con la red y dispositivos del recinto; objetivo propuesto menor de dos segundos, aún sin certificar. Preparar hotspot de respaldo y batería. Nunca aprobar ingresos offline.

## Venta, correo, impresión y caja

1. **Taquilla:** abrir caja con fondo ficticio; vender tres entradas en una orden, comprobar tres QR y números distintos, descargar boletas y verificar consumo de cupos del evento correcto. Registrar efectivo y transferencia ficticios separadamente, con su justificación de ensayo.
2. **Online:** desde una cuenta de comprador entrar a `/events`, comprar en un evento publicado y seguir Wompi sandbox. Probar aprobación y rechazo en órdenes independientes. No usar tarjetas reales. Los datos oficiales de tarjeta sandbox incluyen `4242 4242 4242 4242` (aprobada) y `4111 1111 1111 1111` (rechazada), vencimiento futuro y CVC de tres dígitos; si aparece 3DS seguir el escenario específico del checkout de pruebas. Fuentes: [datos sandbox](https://docs.wompi.co/docs/colombia/datos-de-prueba-en-sandbox/) y [escenarios 3DS](https://docs.wompi.co/docs/colombia/transacciones-con-3d-secure-v2/).
3. **Confirmación:** comprobar orden confirmada solo después de pago verificado, entradas en Mis entradas, correo recibido y PDF descargable. La rechazada no debe emitir entradas. El retorno de Wompi por sí solo no prueba confirmación. Dejar una reserva sin pagar y comprobar vencimiento/liberación; verificar la duración configurada antes de medirla.
4. **Impresión:** primero usar el diálogo del navegador con driver instalado y papel de 80 mm; comprobar QR completo, margen blanco, contraste, corte y lectura con Honeywell. Reimprimir debe conservar números y QR y no aumentar ventas. QZ Tray es opcional para impresión directa y requiere su configuración específica; no hace falta para iniciar pruebas digitales. Impresión enviada no equivale a salida física confirmada.
5. **Operación:** probar cortesía, anulación y devolución manual de ensayo; verificar el dashboard, asistencia, CSV y cierre de caja. El efectivo esperado debe corresponder al fondo y movimientos; Wompi y transferencias no se suman al efectivo físico. No borrar registros para corregir resultados.
6. **Permisos:** comprador ve sus entradas; acceso valida solo eventos asignados; taquilla opera solo sus eventos. Repetir con cuentas separadas y sesiones independientes.

Pendientes técnicos adicionales para completar la validación: checkout/webhook sandbox completo, duplicados y notificaciones fuera de orden, pago tardío sin cupo, fallo/reintento de correo, sustitución de credencial y restauración de respaldo. Revisar LAUNCH_CHECKLIST.md antes de cualquier evento comercial. Esta guía no habilita pagos reales ni certifica impresora, EDA51 o conectividad.

## Registro de esta entrega

Entrega documental: revisión de `Access`, ruta de checkout y guías existentes; consulta de documentación oficial Honeywell/Wompi. Sin cambios de código ni configuración de dispositivos. Verificación aplicable: revisión del diff y formato Git; no se repiten pruebas de aplicación por cambios únicamente documentales. El hash de esta entrega se obtiene con `git log -1 -- docs/TEST_REHEARSAL.md`.
