# Navegación y carga de datos (2026-11-19)

## Causa comprobada

La app usaba enlaces HTML para cambiar de sección. Eso reiniciaba la página, el estado de React y la lectura completa `/api/state`. Además, state.ts repetía consultas de autorización por evento/permiso y enviaba muchas lecturas independientes de forma secuencial a PostgreSQL remoto. El servidor local corre `next dev`, que también compila rutas al usarlas por primera vez.

Medición local contra Supabase staging, administrador global, un evento: dos muestras de `state()` de4474/4328ms y27 consultas dentro de la transacción; no incluyen Auth, petición HTTP, imágenes o navegador. Después de optimizar:2375/2227ms y13 consultas. No es benchmark de carga ni prueba desde Honeywell. Script privado `.local/benchmark-state.ts`, imprime únicamente tiempos/cantidad de consultas/eventos, sin datos personales o secretos.

## Cambios y ubicación

- `src/app/(platform)/layout.tsx`: monta App una vez en un layout compartido que conserva estado al navegar. `src/app/(platform)/[[...path]]/page.tsx` sustituye el anterior catch-all y no duplica App. URLs existentes se conservan. Privacy/Terms/Auth/API siguen fuera del grupo.
- `src/components/app.tsx`, operations.tsx, account.tsx, ticket-wallet.tsx, buyer.tsx y recovery.tsx: navegación interna con `next/link`. Descargas API, enlaces que abren otra pestaña y formularios externos conservan su mecanismo original.
- App muestra la nueva sección con el estado disponible y actualiza datos en segundo plano al cambiar de ruta (300ms de debounce). Cancela actualizaciones obsoletas; un contador evita que una respuesta antigua sustituya datos más recientes. Las pantallas se reinician por pathname para no mezclar campos de dos eventos; no se cachean respuestas en localStorage ni se evita Auth en servidor.
- `src/lib/state.ts`: lee membresías/asignaciones una vez y calcula permisos equivalentes a can(). Lecturas independientes se agrupan en un SELECT de PostgreSQL con resultados JSON; los filtros de autorización y parámetros enlazados se conservan. No se interpolan valores de usuario como SQL. Dependencias (órdenes→entradas, sesiones→movimientos) se mantienen en orden. Transacciones de venta/acceso no cambian.

## Prueba y uso

Iniciar `npm run dev:lan`, abrir APP_URL y recargar una vez para incorporar el layout. Después cambiar con el menú o enlaces internos; no debería aparecer Preparando tu espacio en cada clic. La primera carga aún necesita servidor, Auth y base remota. Actualizar con F5 también necesita la carga inicial completa.

`npm test`: incluye state-permissions.test.ts, comparación de permisos de todos los roles frente a can(), asignación de acceso adicional, permiso revocado y anonimato. `npx playwright test`: navigation.spec.ts retiene deliberadamente la respuesta de state y comprueba que Organizaciones/Caja/Explorar aparecen sin documento nuevo; demás flujos revisan venta/acceso/Auth/impresión. Las métricas de esta prueba son de Chromium y base demo aislada, no tiempos de Supabase o hardware real.

Las escrituras siguen autorizadas en servidor con precios/cupos/roles actuales; el estado visible no concede permisos ni confirma ventas. No se habilita acceso offline. Sin nueva dependencia, migración, publicación o escritura de datos de ensayo en Supabase.

Comprobación adicional LAN real con Chromium anónimo y Supabase conectado: Eventos→Login106ms, mismo documento conservado y0 erroresJS. Medida de una navegación local, no extrapolar al administrador/Honeywell. Script privado .local/check-lan-navigation.mjs, sin credenciales. No compras ni cambios de cuentas/datos en esta comprobación.
