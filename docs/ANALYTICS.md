# Ventas y audiencia — 2026-10-13

## Dónde se usa

**Vista general** (`/admin`) y **Análisis y reportes** (`/admin/reports`) comparten `src/components/analytics.tsx`. Administrador global y organizadores pueden consultar exclusivamente sus eventos administrados; taquilla, acceso y comprador no reciben estos análisis.

Filtros: año de la fecha del evento, todos/un evento, segundo evento para comparar, fechas de ventas y audiencia de entradas vigentes o con ingreso registrado. Cambiar de año restablece la selección de eventos. Actualizar análisis consulta el servidor nuevamente. Los errores y la carga retiran los indicadores anteriores para evitar atribuir resultados de otro filtro.

Incluye ventas brutas, devoluciones registradas, ventas menos devoluciones, cobros aprobados, entradas vendidas/cortesías/anuladas, promedio por orden, ingresos/asistencia, disponibilidad actual, reservas, incidencias, compradores con cuenta y diferencias de caja. Tablas: ranking de eventos, años y variación interanual, fases, localidades, canales, operadores, medios de cobro, evolución diaria y categorías de comprador. Fases/localidades pueden consolidarse por nombre entre eventos. Cada análisis permite CSV privado con títulos en español y neutralización de fórmulas.

Los CSV tradicionales de ventas, asistentes, cajas e incidencias en Reportes también respetan eventos/año/fechas. La auditoría y su guía permanecen independientes de los filtros de ventas. No se añadieron registros de prueba a Supabase.

## Recoger información del público

En compra web y taquilla, elegir cantidades y abrir **Datos opcionales de cada asistente**. Marcar la autorización de uso estadístico y autorización del asistente/responsable de menores, después elegir género y rango de edad de **cada entrada**. Edad declarada para la fecha del evento. Se pueden omitir ambos o uno; no se copian datos del comprador a sus acompañantes, no se solicita nombre del asistente ni fecha de nacimiento.

Género: mujer/femenino, hombre/masculino, otro, prefiero no responder; omisión = Sin dato. Rangos: 0–5, 6–12, 13–17, 18–24, 25–34, 35–44, 45–54, 55–64, 65+. Menores se contabilizan por edad y nunca como categoría de género. Barras muestran número y porcentaje sobre todas las entradas incluidas, además de cobertura de información. Entradas anteriores sin datos quedan **Sin dato**; no se infiere información a partir de nombres, teléfono o correo.

Cada entrada emitida se vincula a un registro por localidad/ordinal de `order_attendees`. Transacción de compra y emisión idempotente mantienen esa correspondencia. Revocar la casilla en el formulario omite los datos; el servidor rechaza datos informados sin consentimiento y arrays cuya longitud difiere de la cantidad. No existe edición posterior de audiencia en esta entrega. Los rangos no imponen automáticamente reglas de admisión; establecer condiciones del evento por separado.

## Definiciones de cálculo

- **Año:** inicio del evento convertido a America/Bogota, no año de compra. Los filtros desde/hasta son inclusivos por día de Bogotá.
- **Ventas:** órdenes efectivamente confirmadas (`confirmed_at`) en estado confirmado o con devolución. Pendientes/incidencias se filtran por creación. La migración 007 reconstruye confirmaciones históricas usando primera emisión, con fecha de creación como respaldo si ya estaban confirmadas; no reconstruye demografía.
- **Vendidas:** entradas emitidas en órdenes con cobro, incluso anuladas/devueltas posteriormente. Vigentes se muestran aparte. Cortesías no cuentan como venta ni alteran el promedio por orden con cobro. Importes de fases/localidades usan snapshots de líneas históricas, no precios actuales.
- **Ventas menos devoluciones:** ventas brutas menos todas las devoluciones registradas de esas órdenes. No es utilidad, no descuenta costos/comisiones y no representa depósitos bancarios. CSV resumen distingue devoluciones completadas. Fechas delimitan las órdenes de venta, no la fecha de devolución.
- **Cobros aprobados:** pagos por fecha de verificación/aprobación, independientes de la fecha de venta. Incluyen pagos tardíos en revisión sin boletas; por ello pueden diferir de ventas. Online Wompi agrupa checkout: actualmente no se guarda distinción Nequi/tarjeta en los pagos históricos.
- **Asistencia:** entradas con `used_at` o estado used, sobre entradas vigentes o con ingreso histórico. Una anulación posterior no borra el ingreso. Audiencia con ingreso incluye ese historial; vigentes excluye entradas anuladas.
- **Disponibilidad:** aforo menos compromisos vigentes **actuales**, incluyendo reservas activas y órdenes confirmadas/con devolución según la regla de inventario existente. No depende del período de ventas ni libera cupos por una anulación/devolución.
- **Confirmación web:** proporción de órdenes web confirmadas dentro del filtro de órdenes; no conversión de visitas, pues no se mide navegación anónima.
- **Compradores con cuenta:** identidades verificadas distintas vinculadas a órdenes con cobro. Órdenes sin cuenta se cuentan aparte; no se deduplican por correos escritos en taquilla.
- **Variación anual:** ventas menos devoluciones frente al año de evento inmediatamente anterior, solo si el anterior tiene base positiva. Años sin esa base muestran guion, no un crecimiento inventado.
- **Lecturas/cajas:** fecha propia del intento/cierre; audiencia sigue la cohorte de órdenes seleccionadas, no un filtro adicional por fecha de ingreso.

## Código, base y ejecución

`src/lib/analytics.ts`: validación Zod, permiso SQL `app_private.can_event(...,'manage')` con identidad confiable del servidor, lectura coherente REPEATABLE READ y agregados puros. `/api/analytics` devuelve únicamente agregados y CSV con `Cache-Control: private, no-store`. Solicitar evento ajeno explícitamente resulta 403. No devuelve correos, teléfonos, QR, tokens, nombres de asistentes ni registros demográficos individuales.

Migración `supabase/migrations/007_attendee_analytics.sql`: confirmed_at y trigger para despliegue gradual, recorded_at de devolución, tabla order_attendees RLS sin SELECT directo para anon/authenticated y FK compuesta de boleta/asistente dentro de la misma línea. Sin funciones privilegiadas públicas de demografía. `src/lib/service.ts` conserva autorización/transacción de venta y emisión. `src/lib/state.ts` no expone las filas individuales. `src/components/attendee-fields.tsx`, `demographics.ts` y `validation.ts` concentran formulario/catálogos/validación. Aviso de privacidad en `/privacy` explica el uso opcional.

Servicios existentes: PostgreSQL Supabase, Auth para identidad; Next.js/React, Zod, Intl y CSV propio. Sin proveedor de analítica externo, nuevas cuentas, claves, correos masivos ni servicios adicionales. No altera Wompi sandbox o la entrega de entradas.

Migrar: `node --env-file=.env.local --import tsx scripts/migrate.ts`. Mantener el archivo privado fuera de Git. Probar con `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, `npm run build`; no ejecutar build junto al servidor E2E. Pruebas `tests/analytics.test.ts` y `tests/e2e/analytics.spec.ts`, más compra web en flows.spec.ts. Las pruebas usan memoria/PostgreSQL local aislado; no generan compras ficticias cloud.

Para una prueba manual: vender dos entradas con datos distintos y otra sin datos; comparar por evento y año, comprobar cobertura y descargar CSV. Hacerlo en desarrollo o con compras que el propietario quiera registrar; no repoblar staging con datos ficticios tras la limpieza solicitada.

Límites: datos declarados/voluntarios no equivalen a un censo verificado, no se cuentan personas únicas si una persona tiene varias boletas, no se infiere público histórico. Los agregados leen registros autorizados completos para este MVP; medir volumen/latencia y optimizar agregación SQL/paginación antes de grandes volúmenes. No añade gastos, utilidad, campañas, fuentes de adquisición, conciliación bancaria o medios online específicos. Hardware Honeywell/impresora no se certifica mediante estas pruebas.
## Entrega verificada

Código `f6f9fe4` publicado Ready en Vercel (`ANdUbW6Qgby9XQT14Lm4dP41LBbW`) en el dominio de staging existente. Migración 007 aplicada a Supabase; agregados, roles/privacidad SQL y preservación de identidad/invitaciones comprobados sin insertar eventos/ventas. En Chrome, sesión administrativa existente verificó Vista general/Reportes, filtros y respuesta del servidor en cero; acceso anónimo /api/analytics devuelve 401. Evidencia privada `.local/verification/analytics-connected-overview.png`. La descarga CSV conectada fue cancelada por Chrome durante automatización: no se afirma archivo descargado en cloud; descarga/encabezados/cache privado verificados en E2E local. 71 Vitest, 11 E2E, lint/tipos/build pasaron. Wompi continúa sandbox; datos ficticios solo en pruebas locales.
