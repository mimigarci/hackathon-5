# Home: qué está analizado, modelado e implementado

**Las seis tarjetas de Funciones existen en Home; ninguna tiene un flujo operativo implementado en el código revisado.** El recorrido REA aporta análisis y especificación documental parciales para cuatro: Estacionamiento, Servicios, Parquímetros y Seguros. Boletería y Donaciones solo se identificaron como accesos visibles; sus formularios siguen sin analizar ni modelar.

Corte: 31 de octubre de 2026. Código revisado: [`5b9e2db`](https://github.com/mimigarci/hackathon-5/tree/5b9e2db29dfcfc6092c1e85db8fb0efc4477a909). Referencia observada: Pago Directo Android 5.3.2 (231), en un emulador separado, usando [REA](https://github.com/morluto/rea). La app de referencia y el prototipo de este repositorio son fuentes distintas.

## Resultado por función

| Función de Home | Recorrido en app de referencia | Modelo documental del agente incluido aquí | Código Flutter / datos actuales | Brecha para considerarla lista |
|---|---|---|---|---|
| Estacionamiento | Parcial: entrada/tutorial BLE, ticket físico QR/manual, error de cámara, búsqueda de lugares; afiliación de vehículo como dependencia | F32–F35: inputs iniciales, requisitos, estados visibles y desconocidos | Tarjeta y destino `PlaceholderScreen`; sin modelo de vehículo, ticket, tarifa ni sesión | Validar consulta/tarifa del ticket, requisitos de vehículo y confirmación; implementar resultado y comprobante. Entrada/barrera no probadas |
| Servicios | Parcial: catálogo de 14 proveedores, formularios por variante, errores de vacío concretos y programación inicial | F13–F31: proveedor/modalidad, inputs distintos, fuentes, dependencias y pasos pendientes | Tarjeta → placeholder. `ServiceProvider` y `Payment` son modelos genéricos; SQL tiene catálogo, `account_ref` y pagos, sin esquemas por variante ni consultas de deuda | Modelar contrato/teléfono/documento según variante, catálogos, deuda/cotización y ejecución; validar programación posterior |
| Parquímetros | Parcial: permiso denegado, primera pantalla, tutorial de selección por mapa/QR | F36–F37, con dependencia F32: permisos y requisitos propuestos, campos posteriores desconocidos | Tarjeta → placeholder; sin modelo de parquímetro, tarifa/duración ni sesión | Confirmar esquema real, selección, disponibilidad, inicio/extensión/finalización y recuperación sin ubicación |
| Seguros | Parcial: Vehículos → Particular → catálogo de coberturas; no adquisición | F38: elecciones observadas y requisitos posteriores pendientes | Tarjeta → placeholder; sin modelo de póliza, cotización ni emisión | Validar elegibilidad, documentación, precio final, aceptación y emisión con proveedor; otras ramas sin recorrer |
| Boletería | Solo acceso visible en Home | Pendiente: cero inputs de formulario confirmados | Tarjeta → placeholder; sin modelo de evento, reserva o compra | Abrir acceso y documentar destino, formularios, estados y contrato real antes de definir campos |
| Donaciones | Solo acceso visible en Home | Pendiente: cero inputs de formulario confirmados | Tarjeta → placeholder; sin modelo de donación | Abrir acceso y documentar destino, formularios, estados y contrato real antes de definir campos |

**Resumen: 4 de 6 con análisis y modelo documental parciales, 2 de 6 pendientes de recorrido, 0 de 6 implementadas como flujos operativos.** Esta cuenta no mide porcentaje de avance funcional: faltan pasos de ejecución y validación en todas.

## Evidencia en el repositorio

- [`home_screen.dart`](../../app/lib/screens/home_screen.dart): `FunctionsGrid(onTap: (f) => openPlaceholder(context, f.label))` dirige las seis tarjetas al mismo destino provisional.
- [`home_sections.dart`](../../app/lib/widgets/home_sections.dart): `appFunctions` enumera las seis funciones. `AppFunction` contiene solo `label`, `icon` y `color`; describe presentación, no inputs, validaciones ni estados de negocio.
- [`common.dart`](../../app/lib/widgets/common.dart) y [`placeholder_screen.dart`](../../app/lib/screens/placeholder_screen.dart): `openPlaceholder` abre una pantalla «Próximamente».
- [`models.dart`](../../app/lib/data/models.dart): hay modelos de perfil, wallet, movimientos, proveedor, pago y Club; no modelos operativos de parking, parquímetros, seguros, boletería o donaciones.
- [`repository.dart`](../../app/lib/data/repository.dart) y [`supabase_repository.dart`](../../app/lib/data/supabase_repository.dart): interfaces y consultas de lectura. No incluyen consultar deuda, cotizar, ejecutar pagos, emitir pólizas ni iniciar sesiones de parking.
- [`schema.sql`](../../supabase/schema.sql): catálogo `services`, vínculo `user_services.account_ref` y tabla genérica `payments`. `getMyServices()` proyecta `services(*)` y devuelve `ServiceProvider`, por lo que no transporta el `account_ref` guardado. El agente no puede suponer que ya recibe el identificador del abonado.
- [`assistant_service.dart`](../../app/lib/data/assistant_service.dart): `reply` devuelve un texto fijo tras una espera. El README describe la experiencia prevista; este servicio aún no demuestra análisis de intención, herramientas ni ejecución de flujos.

Estas conclusiones son una revisión estática de ese commit. No se ejecutó Flutter ni se verificó una instancia desplegada de Supabase para esta auditoría. Las clases/tablas disponibles no demuestran una integración de negocio operativa.

## Inputs que cambian la decisión del agente

El detalle por paso está en [FLUJOS_E_INPUTS.md](FLUJOS_E_INPUTS.md). No se debe usar un formulario genérico para todos los proveedores.

| Variante observada | Qué puede pedir el agente si falta | Qué debe obtener o validar el sistema |
|---|---|---|
| Digitel, Movilnet y Movistar prepago | Prefijo/teléfono y monto elegido del catálogo vigente | Servicio/modalidad, catálogo, cotización y resultado real |
| Digitel postpago | Teléfono y prefijo que muestra su formulario | Consulta y resultado; el error «contrato válido» aparece bajo teléfono y no demuestra otro input |
| Movilnet postpago | Número de contrato | Deuda y pasos posteriores; el hint no prueba longitud obligatoria |
| Movistar postpago | Contrato y tipo de telefonía | El selector dice «Número de tarjeta», pero contiene Telefonía Celular/Internet Móvil y Telefonía Fija: **no pedir una tarjeta bancaria** |
| SimpleTV | Contrato como texto, preservando ceros iniciales | Consulta de deuda y siguiente paso real |
| Inter, Corpoelec, ThunderNet, Global System GPS y Fibex | Tipo y número de documento según UI, mediante captura apropiada | Formato y consulta autorizada; no asumir que abonado y titular de wallet coinciden |
| CANTV | Identificador telefónico exigido por contrato real | No deducir prefijo ni longitud completa de un hint |
| StarMoviles Corp. | Documento/cédula | No añadir selector de tipo no visible ni cambiar la marca a StarMovies |
| DLM | Elección de condominio e inmueble | Relación entre selectores y propiedad autorizada; un default no equivale a intención del usuario |
| TuGruero | Categoría, periodicidad y plan | Requisitos reales y cotización final; «Desde» no es total confirmado |
| JOMI Plomería | Nombre, teléfono y dirección faltantes; descripción opcional | Decisión de reutilizar datos, autorización para compartirlos y resultado de solicitud; no afirmar visita reservada |
| Ticket de estacionamiento | QR **o** código numérico manual | Estado de cámara, ticket, lugar, tarifa y pago real; no pedir ambas alternativas |
| Afiliar vehículo | Abrir carga segura de título de propiedad | Requisitos del archivo y pasos posteriores. Placa/marca/modelo/color no se observaron como campos del primer paso |
| Parquímetros | Decisión de permisos y selección indicada por mapa/QR | Ubicación autorizada, identificador, tarifa y estados; duración posterior no observada |
| Seguros | Tipo, póliza, subtipo y cobertura | Elegibilidad, requisitos y cotización final; no inventar formulario posterior a Adquirir |

El sheet fiscal se puede cerrar y permite explorar catálogos. No se comprobó pagar con el perfil incompleto. No bloquear la consulta por una interpretación anterior ya corregida.

## Otros accesos visibles de Home

Se revisan aquí para no confundirlos con las seis tarjetas de Funciones; sus expedientes completos no forman parte de este PR.

| Acceso de Home | Estado encontrado |
|---|---|
| Afiliar cuenta bancaria | En el prototipo abre placeholder. REA observó formulario parcial para Banco de Venezuela; no afiliación completada |
| Enviar Wallet | Placeholder. REA observó destinatario usuario/teléfono, monto y concepto opcional; no envío |
| Depositar / Más | Placeholders. REA observó métodos de depósito y parte de Pago Móvil/BDV, y menú de opciones; no acreditación ni ejecución |
| Saldo / perfil | Hay modelos de lectura; no son autorización para mover dinero o editar perfil |
| Club: Completar | Hay `ClubTask` y tablas de progreso; la acción abre placeholder. No hay flujo de llave de acceso modelado; afiliación de vehículo solo parcial en REA |
| Mis pagos: Ver todos | Navega al tab `PaymentsScreen`; sí hay listado/modelo genérico de pagos. Esto no prueba el flujo de registrar, pagar o programar |
| Registra tu servicio / accesos de proveedor | Abren placeholder. El esquema por proveedor/modalidad es una brecha, aunque exista catálogo de marcas |
| Sugerencias JOMI / Seguros | Abren placeholder. Los modelos parciales de Servicios/Seguros no prueban que el banner de referencia lleve al mismo destino |
| Avatar, racha, notificaciones y soporte | Sus callbacks abren placeholder. Perfil de lectura y progreso visual no equivalen a estos flujos implementados |
| Credirecto | Tarjeta informativa sin acción en el código revisado; no modelar un crédito activo a partir de ella |

Se excluyen las auditorías de Menú, Movimientos, Wisi, canales de asistencia, comparativas de proveedores de IA y kit general. El botón del asistente está en la navegación compartida, no entre las seis funciones de Home.

## Material incorporado

- [cobertura-home.json](cobertura-home.json): estado y pendientes de las seis funciones, con evidencia del código.
- [modelos/flujos-home.json](modelos/flujos-home.json): **27 tareas documentales, 45 pasos y 97 entradas de formulario/decisión/acción**; no son 97 preguntas ni datos únicos. Solo incluye las funciones de Home y sus dependencias observadas.
- [modelos/ESQUEMA_TAREA.json](modelos/ESQUEMA_TAREA.json): esquema de cada tarea, con procedencia separada para cada hecho.
- [FLUJOS_E_INPUTS.md](FLUJOS_E_INPUTS.md) y [notas-recorrido.jsonl](notas-recorrido.jsonl): detalle legible y 28 notas sanitizadas. Los IDs F originales se conservan aunque se excluyan otras tareas.
- [evidencia/indice-pantallas.json](evidencia/indice-pantallas.json): 60 IDs citados, evidencia REA y SHA-256. Seis capturas de formularios/catálogos revisadas se incluyen; las demás se retienen localmente por minimización de datos. ID de pantalla no significa pantalla única ni cobertura completa.
- [evidencia/procedencia.json](evidencia/procedencia.json): versiones, método y alcance de la observación.
- [VERIFICACION.md](VERIFICACION.md): controles realizados y límites.

Las herramientas de los modelos son propuestas, con `invoked=false`. Ningún endpoint privado de Pago Directo fue validado. Los modelos son documentación para implementar y revisar; no se han conectado al runtime de la app.

## Orden propuesto para cerrar las brechas

1. **Servicios:** implementar una variante prepago y una postpago con identificador correcto, consulta/cotización y confirmación; comparar finalización, errores y tiempo de atención. Aprovecha las superficies ya existentes de proveedores y pagos sin confundirlas con un backend transaccional.
2. **Estacionamiento:** consulta de ticket con QR/manual y estado de cámara antes de pago. Después validar el contrato de Parquímetros y contratación de Seguros. Recorrer Boletería y Donaciones antes de estimar su implementación.

Una función estará lista cuando tenga contrato verificable, inputs/validaciones por variante, estados de carga/error/resultado, ruta funcional, herramienta autorizada, confirmación para acciones con efecto y prueba de integración pertinente. La tarjeta o el modelo documental por sí solos no cumplen ese criterio.
