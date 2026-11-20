# Organización visual de formularios (2026-11-19)

## Dónde quedó

- `src/app/globals.css`: estilos compartidos de pantalla para paneles, formularios, etiquetas, controles, ayudas, tablas y botones. Columnas alineadas en escritorio y una columna con botones completos en móvil. Reglas nuevas bajo `@media screen` para conservar geometría de impresión.
- `src/components/enhanced-fields.tsx`: cupo e interruptor con orden consistente; sección Horarios y acceso que agrupa fin opcional, apertura y cierre.
- `src/components/operations.tsx`: formularios separados para nueva localidad y nueva fase; estados vacíos explicativos.
- `src/components/event-editing.tsx`: edición de localidad en diálogo nativo con foco modal, Escape y cancelación. Conserva validación y permisos existentes.

## Cómo verlo y probarlo

Ejecutar `npm run dev:lan` y abrir el origen APP_URL configurado (ver LOCAL_NETWORK.md). Revisar crear/editar eventos, Localidades y precios, Mi perfil, Equipo y usuarios, Taquilla y Reportes. Los estilos compartidos se aplican a los formularios administrativos y operativos que usan estos componentes.

`npx playwright test tests/e2e/ui-layout.spec.ts` toma capturas a 1440 y 390 px y verifica que el documento no desborde y que nombre/cupo de nueva localidad se alineen. Usa servidor y base demo aislados; no modifica Supabase. Artefactos temporales `test-results/ui-*.png` se regeneran con cada ejecución. Revisar además la edición de localidades con las suites event-options y flows.

## Límites

Revisión visual en Chromium de escritorio con viewport móvil, no prueba física de todos los navegadores ni del Honeywell. Sin nuevas pruebas de impresora. No cambia permisos, inventario ni cobros. Entrega local, sin commit, push o despliegue por instrucción del propietario. Resultados finales de validación en PROGRESS.md.

## Segunda revisión global: organizaciones y catálogo (2026-11-19)

- Organizaciones: ticket-wallet.tsx, componente Organizations. Tarjetas con icono, nombre y cantidad de eventos del estado autorizado; edición separada de creación en dos columnas en escritorio y una en celular. Botones Guardar/Crear con iconos y área propia. Indicador activo y ruta superior en app.tsx. No cambia permisos ni membresías.
- Explorar eventos y Mis eventos: Catalog en app.tsx. Cabecera con fondo suave, barra de búsqueda con icono, cantidad de resultados, tarjetas con datos y acciones alineados, ancho adaptable. Se conserva portada existente y alternativa gráfica; no se generan eventos ni métricas ficticias fuera de modo demo.
- globals.css: verde para acciones principales, azul claro para secundarias, rojo suave para destructivas, estado deshabilitado y foco visibles. Ajustes compartidos de encabezados, botones, tablas, pestañas, estados vacíos y resúmenes. Textos y formularios conservan su lógica. Reglas solo de pantalla, sin modificar plantilla de boletas.
- La revisión visual en ui-layout.spec.ts ahora captura Organizaciones, Explorar eventos, Mis eventos, Vista general, Mis entradas, Caja, Acceso, Crear evento, Equipo, Perfil, Taquilla y Reportes a 1440 y 390 px. Verifica ancho del documento y alineación de localidad. Se inspeccionaron además capturas de organizaciones/catálogo en ambos tamaños y caja/acceso/entradas. No equivale a ensayo físico en Honeywell.

Paleta: fondo #f5f7f7, acción principal #16755e, secundaria #edf5f8/#235b70, destructiva #fff0ee/#a62e2e. No depender solo del color: se conservan etiquetas, estados e iconos. Sin nueva dependencia o servicio externo. Pruebas usan datos demo aislados, no modifican las organizaciones reales. Cambios locales, sin commit/push/despliegue.

## Administradores visibles por organización (2026-11-19)
Cada tarjeta de Organizaciones muestra la sección Administradores de la organización con nombre y correo de las membresías actuales. Fuente: data.members (organization_members) y data.people (profiles) ya autorizados por state.ts. No designa principal, no asigna permisos y no incluye al administrador global como miembro implícito. Si no hay miembros, muestra el aviso de ausencia y recuerda el acceso global. Cuenta eliminada/no disponible muestra una etiqueta de ausencia, sin inventar contacto.
Código: Organizations en src/components/ticket-wallet.tsx, estilos organization-admins en globals.css. Ruta /admin/organizations, accesible al administrador global. Sin migración ni dependencia. La decisión del propietario fue mostrar los administradores actuales, no añadir selección de principal.
