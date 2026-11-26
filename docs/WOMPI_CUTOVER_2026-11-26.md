# Preparación de activación real — 2026-11-26

## Continuación tras nuevo inicio de sesión

Se volvió a observar en Chrome el comercio aprobado ClubGamerZone, abono automático y panel Programadores en producción. URL de Eventos continúa vacía; secretos permanecen ocultos, sin rotación ni copia. Vercel aún indica Hobby. La dirección pública ya es https://pasecentral.vercel.app con Auth/worker actualizados (ver URL_CHANGE_2026-11-26.md).

Se prepara publicación del receptor con guardia de ambiente, manteniendo pagos sandbox actuales. Objetivo: POST a /api/webhooks/wompi/production debe devolver503 hasta habilitar explícitamente las tres variables de producción. Pruebas repetidas antes de publicar: 63 aprobadas, lint/build/tipos aprobados. Se solicitó autorización específica para guardar las cuatro llaves live en variables privadas Vercel del equipo jd's projects/proyecto pasecentral-demo y registrar el webhook; también clasificación de entradas existentes. No se ha recibido todavía esa respuesta. No se compró plan ni se hicieron cobros.

## Precio de hosting consultado

2026-11-26: https://vercel.com/pricing anuncia Pro desde USD20/mes, crédito de uso incluido USD20, impuestos no incluidos y consumo adicional facturable según recursos/plan. Revisar usuarios de pago, límites y total en checkout antes de contratar; no es precio cerrado ilimitado ni incluye comisiones Wompi. El dominio propio es opcional: se puede conservar la URL HTTPS vercel.app existente. No se compró dominio ni plan. Comprar Pro no activa automáticamente Wompi; siguen pendientes configuración live y corte de datos acordado.

## Dominio en HostGator y aplicación en Vercel

Consulta del propietario: comprar/administrar dominio en HostGator y usar Wompi producción en Vercel. Un dominio registrado en otro proveedor se puede conectar al proyecto mediante los registros DNS que Vercel indique. HostGator puede conservar el registro/DNS; si la aplicación se ejecuta en Vercel, el alojamiento sigue siendo Vercel y la compra del dominio no cambia Hobby a Pro ni habilita pagos por sí sola. Para ese esquema no se necesita contratar además alojamiento web en HostGator. Continúan pendientes hosting comercial, llaves live/webhook, URLs de Auth/retorno y tratamiento de datos. Si se pretende ejecutar la aplicación en HostGator, hay que comprobar soporte del plan para Next.js/Node/servidor; no se verificó ningún plan específico ni se migró. Fuentes: https://vercel.com/docs/domains/working-with-domains/add-a-domain y https://vercel.com/docs/limits/fair-use-guidelines. Sin compras, DNS, contratos o cambios cloud.

## Aclaración posterior del propietario

El propietario indica que usará su propio comercio Wompi por ahora y declara ser socio de Pase Central y del cliente Carnavaleando. Pregunta si puede recibir sus recursos en Bancolombia; no es una orden de transferir fondos. La inspección previa del panel comprobó cuenta de ahorros Bancolombia registrada y abono automático activo; el plan mostrado indica desembolso al siguiente día hábil. El valor abonado es neto de descuentos y sujeto a disponibilidad/condiciones del proveedor; no se promete liquidación inmediata ni se inicia retiro/SPT. La declaración de sociedad no acredita por sí sola autorización de Wompi para operar en nombre de otro titular. Hosting comercial y tratamiento de entradas existentes siguen sin decisión. No se cambiaron llaves, cuenta bancaria, abono automático o modo de pagos.

El propietario pidió dejar sandbox y empezar a recibir pagos reales, autorizando revisar su sesión abierta en Chrome. Esta solicitud autoriza preparar el cambio, pero no confirma el modelo de recaudo para terceros, contratación de hosting ni descarte de entradas existentes. No se realizó ningún pago o transferencia.

## Evidencia actual verificada

- En Wompi Comercios, Inicio muestra aprobación del comercio actual. Resumen de cuenta muestra cuenta de desembolso registrada y métodos habilitados: tarjetas, Nequi, PSE y otros. No se copian aquí datos del titular, identificación, teléfono o cuenta.
- Desarrollo → Programadores muestra llave pública de producción y secretos existentes ocultos. No se regeneraron llaves ni se expusieron sus valores. La URL de eventos de producción está vacía.
- El proyecto Vercel `pasecentral-demo`, equipo `jd's projects`, tiene variables privadas preexistentes y equipo con plan Hobby. El plan no admite uso comercial según https://vercel.com/docs/limits/fair-use-guidelines y https://vercel.com/docs/plans/hobby. No se contrató/actualizó ningún plan.
- Inspección SQL de solo lectura: una fiesta publicada, tres órdenes confirmadas (una web y dos de taquilla), once entradas valid y tres preimpresas stock. Configuración privada local conectada aún staging/sandbox. No hay órdenes pending_payment en esta inspección. No se borró, anuló o reclasificó ningún registro; origen real/simulado de cobros manuales no confirmado.
- Las credenciales globales de Wompi existentes no implementan comercios separados por organización. No se da por autorizado recaudar por otros organizadores solo porque Wompi apruebe el comercio. Reglamento y consulta pendiente en WOMPI_PRODUCTION.md.

## Código preparado, aún local

`src/app/api/webhooks/wompi/production/route.ts` crea receptor exclusivo `/api/webhooks/wompi/production`. Solo delega si APP_MODE, APP_ENVIRONMENT y WOMPI_ENV son production; de otro modo devuelve503 antes de procesar pagos. Reutiliza el receptor existente, manteniendo firma, consulta autenticada a Wompi, comprobación de importe/referencia/moneda e idempotencia. No registrar esta URL en Wompi antes de publicarla y comprobar la configuración final.

Se mantiene `/api/webhooks/wompi` para la integración existente. Según https://docs.wompi.co/docs/colombia/eventos/ los ambientes deben usar URLs diferentes. No se introdujeron caminos que aprueben pagos sin validación ni un servicio de dispersión.

## Decisiones solicitadas al propietario

1. Cobrar eventos del propio comercio o terceros; si terceros, confirmar autorización expresa de Wompi.
2. Hosting comercial: cambiar a Vercel Pro o elegir otro hosting permitido. El propietario debe aceptar el coste/contrato; no hay autorización para comprar un plan en este pedido.
3. Separar una base de producción de la de ensayo o conservar como válidas las entradas actuales. Definir el tratamiento de ventas sandbox y manuales, aforo, preimpresas y cuentas sin borrar datos financieros. No seleccionar un reset automático ni considerar simulaciones como ventas reales.

Una vez resuelto: fijar origen HTTPS, entorno/DB/Auth/email/worker, respaldar configuración y datos, publicar el receptor, guardar las cuatro llaves live existentes en variables privadas de servidor del proyecto acordado y configurar el webhook correspondiente. Antes de transmitir secretos a Vercel mediante navegador, confirmar el destino/alcance exacto conforme a la política de control del navegador. Las llaves no van al chat, Git, logs o documentación. No rotar la clave de cifrado de entradas al cambiar Wompi.

La primera compra real debe realizarla el propietario en el checkout y verificarse luego en Wompi, base, emisión única, correo/PDF y Mis entradas. No afirmar ensayo end-to-end de producción antes de observarlo. Cobro aprobado y abono bancario siguen siendo estados distintos.

## Pruebas

`tests/production-webhook.test.ts`: rechaza configuraciones incompletas o sandbox sin invocar procesador; producción delega y conserva errores de autenticidad. Pruebas de este archivo y `service.test.ts`:63aprobadas. Build aprobado e incluye nueva ruta; lint, comprobación de tipos y diff-check aprobados. No cambios cloud, migraciones, commit/push/despliegue o envíos reales en esta preparación.

## Llaves reales y separación autorizadas — 2026-11-26

El propietario autorizó específicamente guardar las cuatro llaves reales en Vercel y el webhook; confirmó que los registros actuales son pruebas y pidió una base separada. Se guardaron cuatro variables Secret exclusivas de Production en Vercel jd's projects / pasecentral-demo: WOMPI_LIVE_PUBLIC_KEY, WOMPI_LIVE_PRIVATE_KEY, WOMPI_LIVE_EVENTS_SECRET y WOMPI_LIVE_INTEGRITY_SECRET. Son reservas inactivas: el código sigue leyendo WOMPI_PUBLIC_KEY, WOMPI_PRIVATE_KEY, WOMPI_EVENTS_SECRET y WOMPI_INTEGRITY_SECRET existentes, con ambiente sandbox. No modificar su lectura ni WOMPI_ENV hasta corte coordinado a nueva base. Vercel confirmó guardado; no se redeplegó por estos valores todavía.

Wompi Programadores: URL de Eventos guardada y verificada al volver a entrar: https://pasecentral.vercel.app/api/webhooks/wompi/production. Receptor publicado en commit 1c5a94c, Vercel success, devuelve503 hasta habilitar ambiente real. No hubo cobros, transferencias ni correos.

Incidente de manejo: una inspección DOM devolvió accidentalmente valores privados de Wompi en la salida técnica. No se copiaron a archivos/Git; se informó al propietario y se recomienda rotarlos antes de activar producción. La rotación debe completarla el propietario conforme al control de cambios de credenciales; después reemplazar los cuatro secretos LIVE guardados. No incluir valores del incidente en documentación. Variables de memoria del navegador limpiadas tras guardarlas.

Supabase: se abrió New Project en organización clubgamerzone, nombre pasecentral-produccion, región Americas, Data API habilitada, acceso automático de API a nuevas tablas desactivado y RLS automático activado. Contraseña vacía; proyecto aún no creado. El propietario debe introducir/guardar su contraseña y completar creación; nunca pedirla en chat. Organización Free muestra dos proyectos existentes; no se prometió disponibilidad de un tercero ni se contrató plan. No borrar ni pausar otros proyectos sin autorización. Tras creación: conexión privada TLS, migraciones sin seed, Auth/Storage/SMTP, bootstrap, worker, pruebas y corte; aún no realizado.

Vercel permanece Hobby; contratación comercial pendiente. No activar cobros ni afirmar lanzamiento completo antes de resolver hosting, nueva base, rotación y ensayo real del propietario.

## Proyecto nuevo creado — 2026-11-26

Verificación posterior al retorno del propietario: Supabase pasecentral-produccion, ref oslmaxdagamvdeuqxqli, estado Healthy, región ca-central-1. Dashboard indica No migrations; no se ha conectado la app a este proyecto. Site URL configurado a https://pasecentral.vercel.app y cuatro redirects exactos (raíz, /auth/confirm, type=signup, type=recovery); éxito de guardado confirmado. No se copiaron registros del proyecto de pruebas.

Para ejecutar migraciones por conexión TLS falta la contraseña PostgreSQL nueva en el archivo privado ignorado .local/production.env, variable DATABASE_PASSWORD. Se preparó vacío sin reutilizar contraseña de staging. Nunca imprimir el contenido ni pedirlo en chat. Pendientes: conexión TLS, migraciones sin seed, buckets/RLS/Auth/SMTP, administrador inicial, worker, rotación llaves live, hosting comercial y corte de variables. No activar WOMPI_ENV real sobre la base anterior.
