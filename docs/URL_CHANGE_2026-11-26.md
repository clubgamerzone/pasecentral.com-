# Cambio de dirección pública — 2026-11-26

Dirección principal: https://pasecentral.vercel.app. Se mantiene el alias anterior para conservar enlaces de entradas y callbacks. Este cambio no activa Wompi real ni compra un plan de Vercel.

## Configuración aplicada

- Vercel, equipo jd's projects, proyecto pasecentral-demo: nuevo dominio de Production y APP_URL de Production guardados con el nuevo origen. El nombre interno del proyecto permanece igual.
- Supabase, proyecto pasecentral.com-demo: Site URL actualizado; ocho redirects autorizados, conservando los cuatro anteriores y agregando raíz y callbacks de confirmación/recuperación del nuevo origen. No se cambiaron cuentas ni SMTP.
- Worker: secreto pasecentral_worker_url de Vault actualizado al nuevo /api/worker. Token, horario, comando y condición de las tres colas conservados. Respaldo cifrado privado en .local/backups/url-change-*/worker-before.enc; script privado .local/update-worker-origin.ts.
- El propietario completó la verificación de identidad de Vercel. Se observó Ready en el despliegue 4tnSsiXhbHKBNXr3bcnASPNc72Ns, con fuentes 8aaca96a3abd4d6a6e99f0d59cfce534c92d6454 y nueva configuración.

## Compatibilidad de enlaces anteriores

src/proxy.ts redirige GET/HEAD de páginas del alias antiguo al nuevo con HTTP308, conservando ruta y query. Solo opera cuando APP_URL coincide exactamente con el nuevo dominio. API y POST no se redirigen: el webhook Wompi existente puede seguir usando el alias anterior. No cambia credenciales ni ambiente de pagos. Las sesiones pueden requerir iniciar sesión otra vez.

## Verificación

Lint, tipos, build y diff-check aprobados al preparar el proxy. tests/canonical-url.test.ts y pruebas de Auth: 16 aprobadas. Comprobaciones públicas del despliegue Ready: login200; callback sin token redirige al login del nuevo origen; acción Auth inválida con Origin nuevo devuelve400; worker sin credenciales401; webhook antiguo con cuerpo inválido400 sin redirección. No se enviaron correos ni se crearon compras para probar.

La publicación del proxy se verifica con el estado Vercel del commit y comprobando que la página antigua responda308. Script privado .local/verify-url-cutover.mjs; evidencia privada en .local/verification/url-change/http.json. Commit de implementación: consultar git log -1 -- src/proxy.ts.

## Límites

Wompi continúa en su ambiente anterior. Pagos reales y cambio de plan comercial siguen siendo trabajo independiente. Mantener ambos alias mientras existan enlaces enviados anteriormente. No guardar secretos o enlaces privados en esta guía.
