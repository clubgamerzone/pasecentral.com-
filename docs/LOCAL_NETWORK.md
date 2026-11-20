# Pruebas en red local

## Iniciar y acceder

El frontend y el backend son una sola aplicación Next.js: puerto TCP **3000**. Las rutas `/api/*` usan el mismo origen; no se necesita otro backend ni un puerto de PostgreSQL abierto hacia el Honeywell.

En PowerShell:

```powershell
cd 'D:\My projects\pase central'
npm run dev:lan
```

`dev:lan` en package.json ejecuta `next dev --hostname 0.0.0.0 --port 3000`. No iniciarlo por segunda vez si ya está corriendo. Para detener el proceso iniciado en tu terminal, Ctrl+C.

Dirección verificada en este ensayo: **http://192.168.1.15:3000/login**. PC y Honeywell deben estar en la misma red local, sin aislamiento entre dispositivos. Usar esa dirección también en el PC para las operaciones: `.env.local` conserva `APP_URL=http://192.168.1.15:3000`, y las peticiones de escritura validan ese origen exacto. No se relajó CSRF ni se habilitaron orígenes arbitrarios. La IP puede cambiar por DHCP: consultar `ipconfig`, actualizar APP_URL en el archivo privado y reiniciar el servidor. Si se usa otro puerto, actualizar tanto comando como APP_URL y la regla específica.

La app usa la configuración existente de **staging conectado a Supabase, Wompi sandbox**; ejecutar el código local no crea una base aislada. Las cuentas reales del ensayo se conservan y se inicia sesión con ellas; no compartir contraseñas. La base PostgreSQL embebida `.local/postgres` también fue limpiada, pero no es la utilizada por este servidor conectado. El modo demo sigue restringido a localhost y no fue habilitado en la LAN.

## Firewall

Regla creada por PowerShell elevado: `PaseCentral-Dev-3000-Private-LAN`, TCP entrante 3000, perfil **Private**, origen **LocalSubnet**, programa node.exe instalado. No se abrió el perfil público, no se desactivó el firewall y no se configuró redirección de puertos en el router. La red Ethernet estaba clasificada Private en la verificación. Si la red cambia a Public, la regla no aplica.

Reproducir manualmente en PowerShell como administrador si la regla no existe:

```powershell
New-NetFirewallRule -Name 'PaseCentral-Dev-3000-Private-LAN' -DisplayName 'Pase Central - desarrollo local 3000' -Direction Inbound -Action Allow -Enabled True -Profile Private -Protocol TCP -LocalPort 3000 -RemoteAddress LocalSubnet -Program (Get-Command node.exe).Source
```

Cuando se termine el ensayo, se puede deshabilitar la regla específica desde PowerShell como administrador:

```powershell
Disable-NetFirewallRule -Name 'PaseCentral-Dev-3000-Private-LAN'
```

El comando no modifica otros puertos o reglas. El servidor de desarrollo y HTTP se usan para este ensayo en la red local; el sitio publicado conserva su URL HTTPS y no se cambió su configuración.

## Verificación realizada

- Listener `0.0.0.0:3000`, Next.js 16.4.6 listo.
- Solicitud HTTP desde el propio PC a la IP de la LAN: `/login` 200, `/api/state` 200 y cero eventos públicos.
- POST `/api/commands` con origen correcto, sin sesión: 401; origen ajeno: 403.
- Regla creada mediante proceso elevado, resultado satisfactorio registrado en `.local/lan-firewall-result.json`.
- El acceso desde un segundo dispositivo/Honeywell necesita confirmación física; una comprobación desde el mismo PC no lo demuestra.

No hubo push ni despliegue. Las credenciales permanecen en `.env.local`, fuera de Git.

## Corrección de carga por IP local
Después de habilitar LAN, el propietario reportó pantalla sin abrir. HTTP/JS/API respondían200, pero el navegador quedaba en Preparando tu espacio; log Next mostraba bloqueo cross-origin del recurso dev /_next/hmr desde IP LAN. Se añadió en next.config.ts allowedDevOrigins con únicamente hostname de APP_URL y solo NODE_ENV=development, sin comodines. No modifica originCheck de API ni permisos de producción. Reiniciado npm run dev:lan. Verificado mediante Chromium real (Playwright script privado .local/check-lan-page.mjs): catálogo renderizado, enlace de login,0 eventos disponibles,sin pageerrors. Typecheck aprobado. Si navegador conserva estado anterior, recargar Ctrl+F5 en dirección LAN. Cambiar APP_URL/IP exige reiniciar para reconstruir allowedDevOrigins. No push/despliegue.

## crypto.randomUUID al comprar por HTTP LAN (2026-11-19)
La captura Runtime TypeError crypto.randomUUID is not a function en EventPurchase corresponde a incompatibilidad de API del navegador, no a un indicador de criptomineria/criptoactivos o por si mismo evidencia de intrusion. Crypto es la API de aleatoriedad/criptografia. Verificado Chromium en IP LAN HTTP: isSecureContext=false, typeof crypto.randomUUID=undefined, typeof crypto.getRandomValues=function. randomUUID exige contexto seguro; getRandomValues puede usarse por HTTP.
Corregido src/lib/browser-id.ts: UUIDv4 con API nativa si existe, alternativa mediante16bytes de getRandomValues y bits de version/variante; si no hay fuente segura, error explicito. Nunca Math.random. Reemplazadas llamadas cliente en buyer.tsx (idempotencia compra) y operations.tsx (taquilla, reinicio de orden, escaneo/reintentos y acceso manual). No se reemplazan tokens QR, que siguen generados con node:crypto en servidor; no se modifican pagos/usuarios ni se debilitan validaciones.
Verificacion:106Vitest aprobados incluidos3 casos de helper. Dos flujos E2E relevantes (taquilla/PDF/acceso/caja y comprador/reserva/pago demo/QR) pasan con randomUUID deliberadamente ausente en navegador. Lint,tipos y build pasan. Comprobacion real de LAN con Chromium no muestra pageerrors; en consulta anonima el evento solicitado no estaba disponible para compra, por lo que no se hizo una compra conectada. Sin correos, pagos reales o nuevo ensayo fisico Honeywell. Script de comprobacion privado .local/check-lan-purchase.mjs, no contiene credenciales. Servidor se reinicia; recargar Ctrl+F5. Sin commit/push/deploy.
Fuentes: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID ; https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues .
