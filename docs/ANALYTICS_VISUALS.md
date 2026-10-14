# Análisis visual — 2026-10-14

## Uso

Vista general (`/admin`) y Análisis y reportes (`/admin/reports`) comparten la misma visualización y los filtros autorizados de `src/components/analytics.tsx`. No cambió la definición de ventas/cobros/audiencia, el permiso de consulta ni el CSV de `src/lib/analytics.ts` y `/api/analytics`. Comprador/taquilla/acceso no obtienen los análisis administrativos.

- Cuatro indicadores principales visibles; botón «Ver 8 indicadores de operación y caja» muestra el resto. Alertas de revisión, pendientes, cupo bajo y diferencia agregada de caja permanecen visibles aunque se oculten tarjetas secundarias.
- Línea de evolución diaria: eje temporal real, ventas brutas por fecha de confirmación en Colombia. Cada punto permite clic, foco/Enter/espacio para leer fecha, importe y entradas. Un único día tiene un punto; no se dibuja una tendencia inventada. Días intermedios unidos no son estimaciones.
- Tortas tipo dona: ventas por canal (entradas), cobros por medio (importe aprobado), género por entrada. Leyenda con valores y porcentajes; clic resalta categoría, segundo clic restaura todas. Sin dato y Prefiero no responder son categorías visibles, sin inferir identidad. No representan personas únicas.
- Barras: ranking de eventos según selector de vendidas/neto/ingresos, comparación por año, fases, localidades, operadores, categorías, edades y lecturas de acceso. Primeras ocho filas; «Ver las N categorías» permite expandir. Neto usa eje central con barras negativas a la izquierda, sin ocultar el signo. Categorías mantienen nombres y cifras completas.
- Tablas exactas dentro de «Ver tabla de datos: …»; CSV se conserva fuera de ese desplegable. No se sustituye el detalle financiero por una imagen.

## Color y límites

Verde: ventas/cobros positivos registrados, saldo neto positivo y accesos aceptados. Amarillo: pendientes, disponibilidad de 10% o menos del aforo total seleccionado, sobrante agregado de caja o devolución registrada en tablas. Rojo: saldo negativo, faltante agregado de caja, órdenes que requieren revisión y rechazos de acceso. Gris: sin base/datos o indicadores informativos, sin metas arbitrarias de crecimiento/conversión/asistencia. Las categorías de género/edad/canal tienen colores de distinción, no juicio favorable/desfavorable sobre personas. Color se acompaña de valor, etiqueta y símbolo; no es la única señal.

Saldo de caja es agregado: cero no garantiza que todos los cierres individuales cuadren; revisar detalle de Caja. Cupo bajo es global dentro del filtro, no una alarma predictiva por evento. Neto significa ventas menos devoluciones, no utilidad ni depósito bancario. No hay proyecciones, gastos o metas ficticias. Datos vacíos muestran mensaje, no torta vacía con porcentajes inventados. Wompi continúa sandbox.

## Implementación y ejecución

`src/components/analytics-charts.tsx`: React/TypeScript, SVG nativo para dona/línea y CSS para barras; Intl para COP/números/fechas. `src/app/globals.css`: tarjetas, colores, leyendas y diseño adaptable; `src/components/app.tsx`: título «Tus eventos, de un vistazo». No se agregaron paquetes, servicios externos, claves, cuentas, migraciones ni datos cloud. No se envía analítica a terceros. Componentes reciben exclusivamente los agregados existentes del servidor.

`tests/e2e/analytics.spec.ts`: filtros/CSV, interacción de leyendas, despliegue de tablas/tarjetas, audiencia, móvil sin desbordamiento y escenario controlado de vacíos/saldos negativos/pendientes. Este último usa respuesta simulada solo en navegador local de prueba, nunca en producción. `tests/e2e/flows.spec.ts` usa el nuevo título de Vista general. Capturas locales en `test-results/analytics-charts.png`, `analytics-audience.png`, `analytics-mobile.png` y `analytics-desktop.png`; fixtures de prueba no son métricas reales.

Ejecutar `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, `npm run build`. E2E usa PGlite aislado y APP_MODE=demo; no ejecutar build junto a su servidor Next. Verificación/publicación final registrada en `docs/PROGRESS.md`. Guía original de fórmulas y privacidad: `docs/ANALYTICS.md`.
