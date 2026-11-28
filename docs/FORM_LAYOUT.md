# Formularios y ventanas adaptables

Revisión local del 2026-11-27. La edición de fases heredaba `white-space: nowrap` de la tabla que la contiene. Además, las etiquetas con clase `field` no tenían una distribución compartida entre texto y control; el registro y el perfil usaban esa misma estructura.

## Implementación y acceso

- `src/components/phase-editing.tsx`: Localidades y precios → Editar fase. Usa `dialog.showModal()` con foco modal y cierre con Escape, siguiendo el patrón de apertura de caja. Final de fase ocupa una fila completa y los botones tienen pie propio.
- `src/components/app.tsx`: el componente `Field` identifica su contenedor con `.field`. Registro agrupa condiciones y enlaces en un solo texto junto a la casilla.
- `src/components/buyer.tsx`: mismo agrupamiento para condiciones de compra; no modifica reserva, pago ni aceptación.
- `src/app/globals.css`: columnas `minmax(0, 1fr)`, etiquetas encima de controles, límites de ancho, ajuste de textos y desplazamiento vertical en modales. Se mantienen los interruptores con su distribución propia. Las reglas compartidas nuevas son de pantalla; no cambian las boletas impresas.

Sin dependencias, servicios externos o migraciones nuevas. No se modifican precios, permisos ni ventas.

## Verificación reproducible

`tests/e2e/ui-layout.spec.ts` recorre doce secciones a 1440 y 390 px. Comprueba el modal de fase a 1440, 768, 390 y 320 px: sin desbordamiento horizontal, etiquetas encima de controles y botón Guardar alcanzable mediante desplazamiento incluso con altura de 640 px. También guarda capturas y verifica registro, compra normal y regalo. El registro intercepta únicamente el indicador demo de `/api/state` para mostrar el formulario conectado sin acceder a Auth ni crear cuentas.

En esta sesión se usa la copia privada sin `.env` de `.local/quick-sale-app`, Next con webpack en 127.0.0.1:3100 y PostgreSQL embebido aislado. Después de copiar `src` a esa carpeta: `npx playwright test --config .local/playwright-web-regression.config.ts ui-layout.spec.ts wallet.spec.ts`. No usar fixtures contra Supabase de producción. Capturas temporales en `test-results/phase-modal-*.png`, `buyer-register-*.png`, `buyer-purchase-*.png` y `ui-*.png`.

Resultados finales en `docs/PROGRESS.md`. Chromium con tamaños móviles no equivale a ensayo físico en todos los dispositivos. Entrega local, sin commit, push ni despliegue; se preservan los cambios anteriores de cartera y Android.
