# Avisos de entorno en la cabecera

Cambio solicitado el 2026-11-26: ocultar los avisos técnicos para todos los perfiles en producción y conservarlos en desarrollo/ensayo.

Ubicación: `src/components/app.tsx`, cabecera compartida `.top-right`. Tanto ENTORNO DEMO/PRUEBAS CONECTADAS como Datos del servidor están dentro de `data.environment !== "production"`. La condición usa el ambiente enviado por el servidor, independientemente del rol del usuario. No es un permiso ni modifica autenticación o selección de base de datos.

Verificación: lint, build y tipos aprobados. Comprobación de navegador Chromium sin interfaz sobre el login LAN: los dos avisos continúan visibles. Después de publicar, comprobar la cabecera del login en https://pasecentral.app; ninguno de los dos avisos debe aparecer. No se crearon cuentas, registros o pruebas de pago para comprobarlo.
