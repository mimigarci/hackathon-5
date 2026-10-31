# Flujos e inputs de las funciones de Home

Este documento contiene solo las tareas F12–F38 del recorrido REA: acceso a Funciones, Servicios y sus variantes, programación desde Servicios, afiliación de vehículo como dependencia, Estacionamiento, Parquímetros y Seguros. Boletería y Donaciones quedan sin formulario observado. Los IDs originales se conservan; no son numeración de líneas de este archivo.

Las tareas, fuentes de datos y herramientas propuestas no equivalen a implementación en el repositorio. Los campos de UI se atribuyen a las notas de `notas-recorrido.jsonl`; los requisitos de backend y confirmación se marcan como propuestas o desconocidos. Hint, asterisco, error de vacío y botón gris no prueban la misma regla. No se ejecutó ningún pago.

El formulario fiscal puede cerrarse para consultar catálogos; pagar sin completarlo no se verificó. StarMoviles Corp. es la marca observada. P124 está mal rotulado: muestra Parquímetros, no Seguros.

## F12 — Catálogo de funciones en Home

**Objetivo propuesto:** Resolver servicio por identidad y elegibilidad, no por posición de icono.

**Evidencia:** `P040_home_funciones`.

### F12.1 — Desplazar Home para ver funciones

**Qué ocurre (observado):** Scroll revela Mis pagos con Registra tu servicio y accesos Digitel, Movilnet, Movistar; Funciones con Estacionamiento, Servicios, Parquímetros y Seguros. Encabezado y barra inferior siguen visibles.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Servicio o función | selección (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Catálogo con service_id; Disponibilidad por cuenta y prerequisitos.

**Herramientas propuestas, no existentes/probadas aquí:** `get_service_options`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Accesos adicionales visibles.

**Pendiente:** Otra fila inferior incompleta; formularios de proveedores/parking/seguros no observados aquí.

## F13 — Servicios: solicitud inicial de datos de facturación

**Objetivo propuesto:** Detectar faltantes de facturación sin impedir consultas de catálogo que la UI permite; verificar exigibilidad real antes de pagar.

**Evidencia:** `P041_servicios`, `P042_servicios_facturacion`.

### F13.1 — Cerrar tutorial inicial de Servicios

**Qué ocurre (observado):** Primera entrada muestra tutorial Selección, texto para elegir servicios, indicador de tres pasos y X. Se cerró mediante X.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| X | acción (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Estado de onboarding del usuario.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Se muestra una solicitud de completar facturación; observaciones posteriores prueban que puede cerrarse para consultar catálogo.

**Pendiente:** No se recorrieron los otros pasos del tutorial.

### F13.2 — Revisar datos precargados y faltantes

**Qué ocurre (observado):** Sheet Datos de facturación pide Nombre*, Apellido*, Tipo de documento, Número de documento*, Número de teléfono* con país/prefijo internacional, Correo electrónico*, Dirección corta* y Guardar. Documento/teléfono/correo están precargados.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Nombre* | input (observado) | UI_segura | obligatorio (observado); Campo marcado con asterisco en UI; enforcement de servidor no probado. |
| Apellido* | input (observado) | UI_segura | obligatorio (observado); Campo marcado con asterisco en UI; enforcement de servidor no probado. |
| Tipo de documento | selector (observado) | UI_segura | desconocido (desconocido) |
| Número de documento* | input (observado) | UI_segura | obligatorio (observado); Campo marcado con asterisco en UI; enforcement de servidor no probado.; precargado/visible, no volver a pedir si válido |
| País / prefijo telefónico | selector (observado) | UI_segura | desconocido (desconocido); precargado/visible, no volver a pedir si válido |
| Número de teléfono* | input (observado) | UI_segura | obligatorio (observado); Campo marcado con asterisco en UI; enforcement de servidor no probado.; precargado/visible, no volver a pedir si válido |
| Correo electrónico* | input (observado) | UI_segura | obligatorio (observado); Campo marcado con asterisco en UI; enforcement de servidor no probado.; precargado/visible, no volver a pedir si válido |
| Dirección corta* | input (observado) | UI_segura | obligatorio (observado); Campo marcado con asterisco en UI; enforcement de servidor no probado. |

**Qué necesita el agente (propuesto):** Perfil fiscal existente y sus faltantes; Requisitos de facturación y reglas autorizadas; UI segura para confirmar datos personales.

**Herramientas propuestas, no existentes/probadas aquí:** `get_billing_profile_status`, `open_secure_app_flow`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Faltan nombre, apellido y dirección corta; se solicitó al usuario completarlos personalmente.

**Pendiente:** Asterisco observado no prueba validación de servidor ni límites de formato. No repetir campos precargados si son válidos.

### F13.3 — Distinguir guardado de acceso al catálogo

**Qué ocurre (observado):** No se llenaron ni guardaron datos de facturación por el agente. La observación posterior servicios_catalogo_sin_guardar_facturacion prueba que Atrás cierra el sheet y permite consultar catálogo/formularios.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Guardar | acción de escritura de perfil (observado) | UI_segura | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Guardado validado por backend si el usuario decide completar; Exigibilidad del perfil por operación: consultar, preparar o pagar; Recuperar intención sin perder contexto.

**Herramientas propuestas, no existentes/probadas aquí:** `get_billing_profile_status`.

**Confirmación:** se propone flujo autenticado seguro antes de una escritura/acción sensible. La confirmación concreta posterior no se observó ni se ejecutó.

**Salida observada:** Perfil no guardado; acceso posterior al catálogo demostrado en F14.

**Pendiente:** Resultado de guardado y exigibilidad para ejecutar un pago no comprobados. No bloquear catálogo por inferencia.

## F14 — Consultar catálogo sin guardar facturación

**Objetivo propuesto:** Continuar exploración permitida sin exigir datos que no bloquean esa acción.

**Evidencia:** `P046_salir_facturacion`.

### F14.1 — Cerrar sheet fiscal y entrar al catálogo

**Qué ocurre (observado):** Atrás cierra Datos de facturación sin guardar. El catálogo queda accesible; esta observación corrige la hipótesis de bloqueo total.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Atrás | acción (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Estado de perfil fiscal y exigibilidad por acción; Navegación que conserve la intención.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Catálogo/formularios accesibles sin guardar datos fiscales.

**Pendiente:** No se probó pago con perfil incompleto.

### F14.2 — Seleccionar proveedor

**Qué ocurre (observado):** Stepper Servicios/Gestionar/Listo; tiles iniciales Digitel, Movilnet, Movistar, SimpleTV, Inter, CANTV; otras filas bajo scroll. Directorio/Programar/Historial visibles abajo.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Proveedor de servicio | selección (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Catálogo de service_id y requisitos versionados; Estado de habilitación por cuenta.

**Herramientas propuestas, no existentes/probadas aquí:** `get_service_options`, `get_task_requirements`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Selección de proveedor disponible.

**Pendiente:** Stepper visible no prueba que se haya llegado a Listo.

## F15 — Digitel: prepago y postpago

**Objetivo propuesto:** Usar un esquema distinto para recargar o consultar deuda.

**Evidencia:** `P047_digitel`, `P048_digitel_montos`, `P050_digitel_postpago`, `P051_digitel_validacion_telefono`.

### F15.1 — Elegir modalidad

**Qué ocurre (observado):** Gestionar ofrece Prepago/Postpago.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Prepago / Postpago | tabs (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Proveedor y modalidad explícitos.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Formulario cambia según modalidad.

### F15.2 — Preparar recarga prepago

**Qué ocurre (observado):** Prepago muestra prefijo, Número de teléfono con hint de 7 dígitos, icono contactos, Monto a recargar como dropdown y botón Pagar verde. El catálogo de montos tiene scroll.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Prefijo telefónico | selector (observado) | usuario | desconocido (desconocido) |
| Número de teléfono | input; hint de 7 dígitos (observado) | usuario | desconocido (desconocido) |
| Monto a recargar | selector de catálogo (observado) | usuario | desconocido (desconocido) |
| Contactos | acción alternativa (observado) | usuario | opcional (derivado) |

**Qué necesita el agente (propuesto):** Número completo autorizado; Catálogo de montos vigente; Cuenta pagadora y cotización actual.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`, `prepare_service_payment`.

**Confirmación:** se propone flujo autenticado seguro antes de una escritura/acción sensible. La confirmación concreta posterior no se observó ni se ejecutó.

**Salida observada:** Formulario prepago y catálogo observados; no se pulsó Pagar.

**Pendiente:** Color verde no demuestra que todos los campos sean válidos. No se probó límite ni pago.

### F15.3 — Consultar postpago y conservar el error exacto

**Qué ocurre (observado):** Postpago mantiene teléfono/prefijo, muestra Consultar y no muestra monto previo. Consultar vacío presenta Ingrese un número de contrato válido bajo el teléfono.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Prefijo telefónico | selector (observado) | usuario | desconocido (desconocido) |
| Número de teléfono | input (observado) | usuario | obligatorio (observado); Ingrese un número de contrato válido |
| Consultar | acción (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Esquema de identificador del proveedor; Consulta de deuda antes de importe de pago; Validación semántica sin confundir el texto de error con otro campo.

**Herramientas propuestas, no existentes/probadas aquí:** `lookup_service_account`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Validación de vacío postpago observada; sin consulta de número real.

**Pendiente:** La discrepancia teléfono/contrato del error no demuestra cambio de identificador. Deuda, selección, confirmación y pago posteriores no observados.

## F16 — Movilnet: prepago y postpago

**Objetivo propuesto:** No tratar todas las modalidades como un mismo formulario telefónico.

**Evidencia:** `P053_movilnet`, `P054_movilnet_postpago`.

### F16.1 — Recarga prepago

**Qué ocurre (observado):** Prepago presenta prefijo, teléfono con hint de 7 dígitos, contactos, monto catálogo y Pagar.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Prepago / Postpago | tabs (observado) | usuario | desconocido (desconocido) |
| Prefijo telefónico | selector (observado) | usuario | desconocido (desconocido) |
| Número de teléfono | input; hint de 7 dígitos (observado) | usuario | desconocido (desconocido) |
| Monto a recargar | catálogo (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Número autorizado y catálogo vigente; Cuenta pagadora, cotización y límites.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`, `prepare_service_payment`.

**Confirmación:** se propone flujo autenticado seguro antes de una escritura/acción sensible. La confirmación concreta posterior no se observó ni se ejecutó.

**Salida observada:** Formulario prepago visible; sin pago.

**Pendiente:** Reglas individuales y validación no probadas.

### F16.2 — Consulta postpago por contrato

**Qué ocurre (observado):** Postpago cambia a Número de contrato con hint de 9 dígitos, contactos y Consultar; no muestra prefijo ni monto.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Número de contrato | input; hint de 9 dígitos (observado) | usuario | desconocido (desconocido) |
| Consultar | acción (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Contrato del usuario; Formato real y consulta de deuda.

**Herramientas propuestas, no existentes/probadas aquí:** `lookup_service_account`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Formulario de contrato visible; consulta no ejecutada.

**Pendiente:** El hint no prueba longitud obligatoria de 9 dígitos. Resultado y pago posteriores no observados.

## F17 — Movistar: prepago y tipo de servicio postpago

**Objetivo propuesto:** Resolver el tipo real de servicio pese al rótulo erróneo de UI.

**Evidencia:** `P056_movistar`, `P057_movistar_postpago`, `P058_movistar_tipo_servicio`.

### F17.1 — Recarga prepago

**Qué ocurre (observado):** Prepago muestra prefijo, teléfono con hint de 7 dígitos, contactos, monto catálogo y Pagar.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Prepago / Postpago | tabs (observado) | usuario | desconocido (desconocido) |
| Prefijo telefónico | selector (observado) | usuario | desconocido (desconocido) |
| Número de teléfono | input; hint de 7 dígitos (observado) | usuario | desconocido (desconocido) |
| Monto a recargar | catálogo (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Número autorizado y catálogo de recarga; Cotización y confirmación canónica.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`, `prepare_service_payment`.

**Confirmación:** se propone flujo autenticado seguro antes de una escritura/acción sensible. La confirmación concreta posterior no se observó ni se ejecutó.

**Salida observada:** Formulario prepago visible; sin pago.

**Pendiente:** No se probaron reglas de longitud ni límites.

### F17.2 — Seleccionar servicio postpago

**Qué ocurre (observado):** Postpago muestra Número de contrato, contactos y un selector rotulado Número de tarjeta que contiene Telefonía Celular o Internet Móvil / Telefonía Fija. CTA Consultar.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Número de contrato | input; hint numérico (observado) | usuario | desconocido (desconocido) |
| Número de tarjeta — opciones de tipo de servicio | selector Telefonía Celular o Internet Móvil / Telefonía Fija (observado) | usuario | desconocido (desconocido) |
| Consultar | acción (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Tipo de servicio semántico y contrato; Mapeo autorizado de opciones a valores del proveedor.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`, `lookup_service_account`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Opciones de servicio observadas; consulta no ejecutada.

**Pendiente:** Número de tarjeta es una discrepancia de rótulo; no pedir tarjeta bancaria. No se verificaron deuda ni pasos de pago.

## F18 — SimpleTV por número de contrato

**Objetivo propuesto:** Preservar identidad textual del contrato, incluidos ceros iniciales.

**Evidencia:** `P061_simpletv`.

### F18.1 — Consultar contrato

**Qué ocurre (observado):** Gestionar presenta Número de contrato con hint numérico de ceros iniciales, contactos y Consultar. No se muestra monto previo.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Número de contrato | identificador textual con apariencia numérica (observado) | usuario | desconocido (desconocido) |
| Consultar | acción (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Contrato autorizado y formato real; Consulta de cuenta/deuda antes de preparar importe.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`, `lookup_service_account`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Formulario inicial visible; sin consulta real.

**Pendiente:** No convertir el identificador a entero ni deducir longitud exacta del hint. Deuda, confirmación y pago no observados.

## F19 — Inter por documento

**Objetivo propuesto:** Resolver cuenta de servicio usando el documento que corresponda al abonado.

**Evidencia:** `P063_inter`.

### F19.1 — Consultar documento

**Qué ocurre (observado):** Gestionar muestra Número de documento, selector de tipo, campo numérico, contactos y Consultar.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Tipo de documento | selector (observado) | UI_segura | desconocido (desconocido) |
| Número de documento | input; hint numérico (observado) | UI_segura | desconocido (desconocido) |
| Consultar | acción (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Documento autorizado de la cuenta de servicio; Formato real y consulta de contratos/deuda.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`, `lookup_service_account`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Formulario inicial visible; sin consulta.

**Pendiente:** El documento puede corresponder a otro abonado; no asumir titular de wallet. No se observaron resultados o selección de contrato.

## F20 — CANTV por teléfono

**Objetivo propuesto:** Pedir el identificador correcto sin agregar prefijos o longitudes no demostrados.

**Evidencia:** `P065_cantv`.

### F20.1 — Consultar teléfono

**Qué ocurre (observado):** Gestionar muestra Número de teléfono con hint de 7 dígitos, contactos y Consultar. No se ve selector de prefijo.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Número de teléfono | input; hint de 7 dígitos (observado) | usuario | desconocido (desconocido) |
| Consultar | acción (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Formato que realmente exige el proveedor; Identificador autorizado y deuda consultada.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`, `lookup_service_account`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Formulario inicial visible; sin consulta.

**Pendiente:** Formato completo y longitud obligatoria no probados. No agregar selector de prefijo como si fuera observado.

## F21 — Corpoelec por documento

**Objetivo propuesto:** Consultar el identificador que muestra esta UI antes de inferir otros contratos.

**Evidencia:** `P068_corpoelec`.

### F21.1 — Consultar documento

**Qué ocurre (observado):** Gestionar muestra Número de documento, selector de tipo, hint numérico, contactos y Consultar.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Tipo de documento | selector (observado) | UI_segura | desconocido (desconocido) |
| Número de documento | input (observado) | UI_segura | desconocido (desconocido) |
| Consultar | acción (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Documento autorizado; Consulta real y selección inequívoca si devuelve varios contratos.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`, `lookup_service_account`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Primer formulario visible; consulta no ejecutada.

**Pendiente:** NIC no aparece como input observado. Lista de contratos, deuda y reglas posteriores no demostradas.

## F22 — ThunderNet por documento

**Objetivo propuesto:** Consultar cuenta/deuda desde el documento permitido.

**Evidencia:** `P070_thundernet`.

### F22.1 — Consultar documento

**Qué ocurre (observado):** Gestionar presenta Número de documento con tipo, hint numérico, contactos y Consultar.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Tipo de documento | selector (observado) | UI_segura | desconocido (desconocido) |
| Número de documento | input (observado) | UI_segura | desconocido (desconocido) |
| Consultar | acción (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Documento autorizado y contrato real de consulta; Estado/deuda del proveedor.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`, `lookup_service_account`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Solo formulario inicial observado.

**Pendiente:** No se ejecutó consulta, no se conocen respuestas ni pago.

## F23 — Catálogo de servicios bajo scroll

**Objetivo propuesto:** Conservar contexto y resolver cada proveedor por identidad.

**Evidencia:** `P067_catalogo_mas_servicios`, `P069_catalogo_posicion`.

### F23.1 — Ampliar catálogo y volver desde proveedor

**Qué ocurre (observado):** El catálogo conserva posición al volver. Aparecen Corpoelec, ThunderNet, TuGruero, DLM, Global System GPS y el proveedor confirmado después como StarMoviles Corp.; Directorio/Programar/Historial siguen abajo.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Proveedor de servicio | selección (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** service_id y requisitos por proveedor; Estado de navegación conservado.

**Herramientas propuestas, no existentes/probadas aquí:** `get_service_options`, `get_task_requirements`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Más proveedores visibles sin perder posición.

**Pendiente:** La marca correcta es StarMoviles Corp. según P083; nombre interno de archivo no define marca.

## F24 — TuGruero: categoría y planes

**Objetivo propuesto:** Elegir plan sin convertir precio Desde en una cotización final.

**Evidencia:** `P073_tugruero_cargado`, `P074_tugruero_planes`, `P075_tugruero_planes_cargados`.

### F24.1 — Elegir categoría

**Qué ocurre (observado):** Categorías Vehículos/Moto; navegación Adquirir plan/Historial/Soporte.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Vehículos / Moto | categoría (observado) | usuario | desconocido (desconocido) |
| Adquirir plan / Historial / Soporte | navegación (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Catálogo y categorías habilitadas.

**Herramientas propuestas, no existentes/probadas aquí:** `get_service_options`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Entrada a planes de Vehículos observada.

**Pendiente:** No se recorrió contratación de Moto.

### F24.2 — Elegir periodicidad y plan

**Qué ocurre (observado):** Planes disponibles muestra Anuales/Mensuales y tarjetas Classic/Plus/Gold con precio Desde. Hubo spinner de carga. Adquirir gris sin selección.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Anuales / Mensuales | tabs (observado) | usuario | desconocido (desconocido) |
| Classic / Plus / Gold | catálogo (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Catálogo/precios vigentes; Características/documentación requeridas por el plan; Cotización final del servicio.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`, `get_plan_quote_requirements`.

**Confirmación:** se propone flujo autenticado seguro antes de una escritura/acción sensible. La confirmación concreta posterior no se observó ni se ejecutó.

**Salida observada:** No se seleccionó ni adquirió plan.

**Pendiente:** La UI advierte que precio final depende de características y revisión documental. Formularios, documentos exactos, cotización, aprobación y pago posteriores no observados.

## F25 — DLM: condominio e inmueble

**Objetivo propuesto:** Confirmar propiedad correcta y no confundir un valor por defecto con intención.

**Evidencia:** `P078_dlm`, `P079_dlm_cargado`.

### F25.1 — Esperar catálogo y resolver propiedad

**Qué ocurre (observado):** Gestionar muestra Condominio e Inmueble. Durante carga hay spinner y Consultar gris; luego ambos selectores tienen una opción precargada y Consultar se habilita. Contactos junto a condominio.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Condominio | selector (observado) | usuario | desconocido (desconocido); precargado/visible, no volver a pedir si válido |
| Inmueble | selector dependiente según propósito, dependencia no probada (observado) | usuario | desconocido (desconocido); precargado/visible, no volver a pedir si válido |
| Consultar | acción (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Propiedades autorizadas y catálogos; Confirmación de la selección deseada; Consulta de deuda solo para la propiedad correcta.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`, `lookup_service_account`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Consultar habilitado con valores precargados; no se consultó.

**Pendiente:** No se probó dependencia al cambiar condominio, pertenencia del primer valor ni resultado de deuda. No copiar valores de propiedad de la sesión.

## F26 — Global System GPS por cédula

**Objetivo propuesto:** Consultar solo la cuenta de servicio autorizada, sin inferir seguimiento de ubicación.

**Evidencia:** `P081_globalgps`.

### F26.1 — Consultar cédula

**Qué ocurre (observado):** Número de cédula con selector tipo, input, contactos y Consultar.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Tipo de documento | selector (observado) | UI_segura | desconocido (desconocido) |
| Número de cédula | input (observado) | UI_segura | desconocido (desconocido) |
| Consultar | acción (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Identificador autorizado y formato real; Consulta de estado/cuenta del servicio.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`, `lookup_service_account`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Primer formulario observado; sin consulta.

**Pendiente:** No se observó rastreo de ubicación, lista de vehículos, deuda ni pago.

## F27 — StarMoviles Corp. por documento

**Objetivo propuesto:** Mantener marca e identificador exactos sin extrapolar selectores de otros proveedores.

**Evidencia:** `P083_starmovies`.

### F27.1 — Consultar documento

**Qué ocurre (observado):** La marca visible es StarMoviles Corp. y el campo Documento / Cédula aparece sin selector de tipo visible; CTA Consultar.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Documento / Cédula | input (observado) | UI_segura | desconocido (desconocido) |
| Consultar | acción (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Formato requerido por StarMoviles Corp.; Autorización y consulta de cuenta/deuda.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`, `lookup_service_account`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Formulario inicial visible; sin consulta.

**Pendiente:** P083_starmovies es nombre interno de captura; no usar StarMovies como marca. No se observó selector de tipo ni resultado.

## F28 — FIBEX por documento

**Objetivo propuesto:** Resolver cuenta/deuda con el documento permitido.

**Evidencia:** `P085_catalogo_inferior`, `P086_fibex`.

### F28.1 — Consultar documento

**Qué ocurre (observado):** Catálogo inferior muestra FIBEX y Jomi. FIBEX Gestionar presenta Número de documento con selector tipo, input, contactos y Consultar.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Tipo de documento | selector (observado) | UI_segura | desconocido (desconocido) |
| Número de documento | input (observado) | UI_segura | desconocido (desconocido) |
| Consultar | acción (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Documento autorizado; Contratos/deuda e importe canónico posteriores.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`, `lookup_service_account`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Formulario inicial visible; no se consultó deuda.

**Pendiente:** Validaciones, resultado de consulta, confirmación y pago desconocidos.

## F29 — JOMI: solicitud de Plomería

**Objetivo propuesto:** Recoger datos mínimos de contacto y compartirlos solo para la solicitud confirmada.

**Evidencia:** `P088_jomi`, `P089_jomi_plomeria`, `P090_jomi_formulario`, `P091_jomi_direccion`.

### F29.1 — Elegir categoría y decidir autocompletado

**Qué ocurre (observado):** Categorías visibles Plomería, Mecánica, Línea blanca, Electricidad, Construcción. Plomería abre ¿Autocompletar formulario? para usar nombre y teléfono de cuenta si solicita el titular. Se eligió No.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Categoría de servicio | catálogo (observado) | usuario | desconocido (desconocido) |
| ¿Autocompletar formulario? No / Sí | decisión (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Si la solicitud es para titular u otra persona; Permiso de usar datos de perfil; Catálogo y requisitos de la categoría elegida.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`, `get_service_options`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Formulario de Plomería abierto sin autocompletar.

**Pendiente:** No extrapolar formulario a todas las categorías.

### F29.2 — Recoger datos y descripción opcional

**Qué ocurre (observado):** Tus datos pide Nombre completo*, Teléfono*, Dirección* y Descripción del problema (opcional), visible con scroll. Continuar gris vacío.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Nombre completo* | input (observado) | UI_segura | obligatorio (observado); Campo marcado con asterisco en UI; enforcement de servidor no probado. |
| Teléfono* | input (observado) | UI_segura | obligatorio (observado); Campo marcado con asterisco en UI; enforcement de servidor no probado. |
| Dirección* | input (observado) | UI_segura | obligatorio (observado); Campo marcado con asterisco en UI; enforcement de servidor no probado. |
| Descripción del problema (opcional) | texto multilínea (observado) | usuario | opcional (observado) |

**Qué necesita el agente (propuesto):** Datos del solicitante y lugar del servicio; Permiso claro para compartir datos con JOMI; Validación por categoría.

**Herramientas propuestas, no existentes/probadas aquí:** `prepare_service_request`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** No se completó ni envió solicitud.

**Pendiente:** Asteriscos/CTA no prueban validaciones de formato o backend.

### F29.3 — Separar solicitud de contacto de servicio confirmado

**Qué ocurre (observado):** Aviso indica que al continuar JOMI contactará para coordinar el servicio, junto a icono WhatsApp. No se continuó.

**Inputs nuevos observados:** ninguno en este paso; no inventar formulario.

**Qué necesita el agente (propuesto):** Resumen de los datos a compartir; Aprobación de la solicitud; Referencia y estado real del proveedor.

**Herramientas propuestas, no existentes/probadas aquí:** `get_service_request_status`.

**Confirmación:** se propone flujo autenticado seguro antes de una escritura/acción sensible. La confirmación concreta posterior no se observó ni se ejecutó.

**Salida observada:** Ningún dato ni solicitud enviado a JOMI.

**Pendiente:** El icono no prueba canal efectivo; no se confirmó reserva, visita, cotización o pago.

## F30 — Mis pagos y programación a usuarios

**Objetivo propuesto:** Consultar programaciones y resolver destinatario antes de inventar recurrencia.

**Evidencia:** `P094_programar_servicios`, `P095_programar_nuevo`, `P096_programar_usuario`.

### F30.1 — Elegir estado o nueva programación

**Qué ocurre (observado):** Mis pagos muestra Pendientes/Programados/Pagados, Total programado y +Programar nuevo pago. Sheet Programar ofrece Pago a usuarios / Servicios Básicos.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Pendientes / Programados / Pagados | tabs (observado) | usuario | desconocido (desconocido) |
| Pago a usuarios / Servicios Básicos | selección (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Programaciones autorizadas y estados; Tipo de tarea: consulta, crear, modificar o cancelar.

**Herramientas propuestas, no existentes/probadas aquí:** `list_scheduled_payments`, `get_task_requirements`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Opciones de programación visibles.

### F30.2 — Resolver usuario para domiciliación

**Qué ocurre (observado):** Pago a usuarios abre Domiciliar pagos con wallet origen, Nombre de usuario / Cédula, lupa y QR.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Nombre de usuario / Cédula | buscador (observado) | usuario | desconocido (desconocido) |
| QR | acción alternativa (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Wallet origen autorizada; Destinatario inequívoco; Esquema real de pasos posteriores.

**Herramientas propuestas, no existentes/probadas aquí:** `resolve_counterparty`, `get_schedule_requirements`.

**Confirmación:** se propone flujo autenticado seguro antes de una escritura/acción sensible. La confirmación concreta posterior no se observó ni se ejecutó.

**Salida observada:** No se seleccionó contraparte ni creó programación.

**Pendiente:** Frecuencia, fecha, monto, mandato recurrente y confirmación no observados. No introducirlos como campos visibles.

## F31 — Programar servicio básico: formulario inicial

**Objetivo propuesto:** Usar requisitos por servicio/modalidad y no confundir contacto con mandato recurrente.

**Evidencia:** `P099_programar_servicio`, `P100_programar_catalogo`.

### F31.1 — Elegir servicio y modalidad

**Qué ocurre (observado):** Programar pago muestra Elige el servicio; selector abre Digitel prepago/pospago, Movilnet prepago/pospago y Movistar prepago visibles. La lista continúa fuera del viewport.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Elige el servicio | selector de catálogo (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Catálogo completo y requisitos por combinación.

**Herramientas propuestas, no existentes/probadas aquí:** `get_service_options`, `get_schedule_requirements`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Parte del catálogo observada.

**Pendiente:** No se registró el resto de opciones fuera de viewport.

### F31.2 — Identificar servicio/contacto

**Qué ocurre (observado):** Para Digitel prepago se ven prefijo y Número de teléfono, icono contactos, Nombre de contacto y Continuar gris.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Prefijo telefónico | selector (observado) | usuario | desconocido (desconocido) |
| Número de teléfono | input (observado) | usuario | desconocido (desconocido) |
| Nombre de contacto | input (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Identificador/contacto seleccionado o guardado; Esquema posterior de programación; Política y autorización de recurrencia en el diseño.

**Herramientas propuestas, no existentes/probadas aquí:** `get_schedule_requirements`.

**Confirmación:** se propone flujo autenticado seguro antes de una escritura/acción sensible. La confirmación concreta posterior no se observó ni se ejecutó.

**Salida observada:** No se creó contacto ni pago programado.

**Pendiente:** Formatos de otras modalidades, fechas, frecuencia, monto, confirmación y cancelación no observados.

## F32 — Afiliar vehículo: primer paso documental

**Objetivo propuesto:** Pedir el documento que realmente se solicita antes de inferir campos del vehículo.

**Evidencia:** `P105_vehiculos`, `P106_afiliar_vehiculo`.

### F32.1 — Comprobar vehículos y abrir afiliación

**Qué ocurre (observado):** Mis vehículos muestra vacío Afila tu primer vehículo y +Afiliar vehículo.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| +Afiliar vehículo | acción (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Vehículos autorizados y estado de afiliación/verificación.

**Herramientas propuestas, no existentes/probadas aquí:** `list_user_vehicles`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Entrada a afiliación desde estado vacío.

### F32.2 — Cargar título de propiedad en UI segura

**Qué ocurre (observado):** Afiliar vehículo muestra dos pasos. El primero pide Sube tu título de propiedad y Título de propiedad (Foto o archivo del documento); Continuar gris sin documento.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Título de propiedad | foto o archivo del documento (observado) | UI_segura | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Componente seguro de carga; Reglas reales de formato/tamaño del archivo; Permiso del usuario para procesamiento; Resultado de OCR/verificación si forma parte del contrato.

**Herramientas propuestas, no existentes/probadas aquí:** `get_vehicle_affiliation_requirements`, `open_secure_app_flow`.

**Confirmación:** se propone flujo autenticado seguro antes de una escritura/acción sensible. La confirmación concreta posterior no se observó ni se ejecutó.

**Salida observada:** Sin documento cargado ni vehículo afiliado.

**Pendiente:** No se abrió cámara ni selector. Formatos/tamaños, OCR y segundo paso no verificados. Placa/marca/modelo/color del AOT no son campos observados aquí.

## F33 — Entrada de estacionamiento

**Objetivo propuesto:** Tratar acceso físico y BLE como acciones de la app con estado real.

**Evidencia:** `P110_estacionamiento`, `P111_estacionamiento_entrada`, `P115_salir_ticket`.

### F33.1 — Leer instrucción de entrada

**Qué ocurre (observado):** Tutorial Entrada indica encender Bluetooth y tocar Entrar para levantar barrera.

**Inputs nuevos observados:** ninguno en este paso; no inventar formulario.

**Qué necesita el agente (propuesto):** Estado de Bluetooth y proximidad autorizada; Vehículo y lugar compatibles.

**Herramientas propuestas, no existentes/probadas aquí:** `get_parking_context`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Requisito visual del tutorial observado.

**Pendiente:** No prueba hardware BLE operativo ni una barrera conectada.

### F33.2 — Inspeccionar pantalla real sin accionar barrera

**Qué ocurre (observado):** Pantalla con stepper Entrada/Sin conexión/Pendiente/Pagado, refresh, asistencia, Entrar; navegación Vehículos/Pagar Ticket Físico/Historial/Ubicaciones.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Entrar | acción de acceso físico, no pulsada (observado) | usuario | desconocido (desconocido) |
| Refresh | acción (observado) | usuario | desconocido (desconocido) |
| Vehículos / Pagar Ticket Físico / Historial / Ubicaciones | navegación (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Vehículo autorizado y estado real de ticket/acceso; Conexión/proximidad y compatibilidad del lugar; Evento real de apertura si el usuario ejecuta.

**Herramientas propuestas, no existentes/probadas aquí:** `get_parking_context`, `open_secure_app_flow`.

**Confirmación:** se propone flujo autenticado seguro antes de una escritura/acción sensible. La confirmación concreta posterior no se observó ni se ejecutó.

**Salida observada:** No se pulsó Entrar; no hubo entrada/salida/pago.

**Pendiente:** No se observó selector de vehículo, conexión BLE, apertura de barrera ni resultado de acceso.

## F34 — Digitalizar ticket físico

**Objetivo propuesto:** Ofrecer fallback manual cuando falle la cámara y verificar ticket antes de pagar.

**Evidencia:** `P112_ticket_fisico`, `P113_ticket_codigo_manual`, `P114_ticket_manual_formulario`.

### F34.1 — Intentar lector y manejar fallo

**Qué ocurre (observado):** Pagar Ticket Físico abre lector con Dónde digitalizar e Ingresa el código numérico manualmente. En este emulador aparece Error accediendo a la cámara.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Ticket por lector QR | captura de cámara (observado) | UI_segura | desconocido (desconocido) |
| Ingresa el código numérico manualmente | acción alternativa (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Estado/permiso de cámara; Canal manual disponible; Lugar/ticket compatible.

**Herramientas propuestas, no existentes/probadas aquí:** `open_secure_app_flow`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Error de cámara observado; alternativa manual accesible.

**Pendiente:** No se escaneó ticket ni se probó cámara en otro dispositivo.

### F34.2 — Identificar ticket por código manual

**Qué ocurre (observado):** Entrada manual muestra input con hint de ceros, Ingresa el código numérico de tu ticket físico, alternativa Escanea el código QR y Aceptar gris vacío.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Código numérico del ticket físico | input de identificador textual numérico (observado) | usuario | desconocido (desconocido) |
| Aceptar | acción (observado) | usuario | desconocido (desconocido) |
| Escanea el código QR | acción alternativa (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Código inequívoco preservando ceros iniciales; Lookup autorizado del ticket, lugar, estado y tarifa; Confirmación canónica antes de pagar.

**Herramientas propuestas, no existentes/probadas aquí:** `lookup_parking_ticket`, `prepare_service_payment`.

**Confirmación:** se propone flujo autenticado seguro antes de una escritura/acción sensible. La confirmación concreta posterior no se observó ni se ejecutó.

**Salida observada:** Sin código ingresado, consulta de deuda ni pago.

**Pendiente:** Longitud/validación del código y pantallas posteriores no comprobadas. No inventar deuda, importe o recibo.

## F35 — Buscar ubicaciones de estacionamiento

**Objetivo propuesto:** Buscar en catálogo compatible sin convertir un vacío puntual en ausencia global.

**Evidencia:** `P116_ubicaciones`.

### F35.1 — Consultar catálogo o buscar lugar

**Qué ocurre (observado):** Ubicaciones disponibles muestra categoría Estacionamientos, buscador Nombre del lugar y Sin resultados en esta captura.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Nombre del lugar | buscador (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Catálogo de lugares compatibles; Estado diferenciado de carga/error/vacío; Búsqueda por nombre.

**Herramientas propuestas, no existentes/probadas aquí:** `search_supported_locations`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Sin resultados visible; búsqueda no ejecutada.

**Pendiente:** Cobertura real de lugares, filtros y resultados de búsqueda no verificados.

## F36 — Parquímetros: permiso y primera pantalla

**Objetivo propuesto:** Manejar permiso denegado y obtener esquema real antes de iniciar una sesión.

**Evidencia:** `P120_parquimetros`, `P121_parquimetros_sin_ubicacion`.

### F36.1 — Solicitar ubicación mediante sistema

**Qué ocurre (observado):** Android solicita ubicación Precise/Approximate con While using/Only this time/Don’t allow. Se eligió Don’t allow.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Permiso y precisión de ubicación | diálogo Android (observado) | UI_segura | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Estado de permisos del dispositivo; Decisión de usuario y política de precisión; Alternativas compatibles si no hay permiso.

**Herramientas propuestas, no existentes/probadas aquí:** `get_parking_meter_context`, `open_secure_app_flow`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Permiso denegado en la observación.

**Pendiente:** No se probó el comportamiento con permiso concedido ni ubicación disponible.

### F36.2 — Mostrar estado sin ubicación y acceso de escaneo

**Qué ocurre (observado):** Pantalla muestra Permite el acceso a tu ubicación y Escanear. Stepper Ubicación/Gestión y pago/En uso/Finalizado; nav Vehículos/Penalizaciones/Historial/Ubicaciones.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Escanear | acción de identificación, no ejecutada (observado) | usuario | desconocido (desconocido) |
| Vehículos / Penalizaciones / Historial / Ubicaciones | navegación (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Ubicación autorizada si el contrato lo exige; Vehículo e identificador inequívocos; Disponibilidad/tarifa y duración desde contrato real; Confirmación antes de iniciar/pagar sesión.

**Herramientas propuestas, no existentes/probadas aquí:** `get_parking_meter_context`, `open_secure_app_flow`.

**Confirmación:** se propone flujo autenticado seguro antes de una escritura/acción sensible. La confirmación concreta posterior no se observó ni se ejecutó.

**Salida observada:** Banner sin ubicación; no se inició, extendió o pagó una sesión.

**Pendiente:** Enforcement del permiso, lector, datos de duración/monto y pasos posteriores no observados.

## F37 — Parquímetros: tutorial de mapa y selección

**Objetivo propuesto:** Interpretar la pantalla realmente observada, no el nombre asignado al archivo.

**Evidencia:** `P124_seguros`, `P125_cerrar_tutorial_parquimetro`.

### F37.1 — Leer tutorial de ubicación sobre mapa

**Qué ocurre (observado):** Aunque P124 fue nombrada Seguros por el script, la imagen muestra tutorial de Parquímetros (Ubicación). Indica seleccionar el que se desea usar según ubicación o escanear su QR; detrás hay mapa y controles.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Selección de parquímetro o QR | alternativas indicadas por tutorial (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Estado real de mapa/carga; Permisos y ubicación autorizados; Identificador del parquímetro elegido.

**Herramientas propuestas, no existentes/probadas aquí:** `get_parking_meter_context`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Tutorial/mapa observados; no se confirmó ubicación real o permiso concedido.

**Pendiente:** La pantalla no prueba que se haya cambiado el permiso, seleccionado un parquímetro o iniciado una sesión. No diagnosticar bug solo por el nombre erróneo del archivo.

## F38 — Seguros: Vehículos → Particular → Coberturas

**Objetivo propuesto:** Seleccionar catálogo y obtener requisitos/cotización sin prometer elegibilidad o cobertura.

**Evidencia:** `P128_seguros`, `P129_seguros_catalogo`, `P130_seguros_tipos`, `P131_seguros_tipo_real`, `P132_seguros_vehiculos`, `P133_seguros_coberturas`, `P134_seguros_particular`.

### F38.1 — Entrar al catálogo real

**Qué ocurre (observado):** Se muestran tutorial Selección de póliza y solicitud fiscal descartable; tras cerrarlos queda UI Tipo/Pólizas/Coberturas, Vehículos/Personas y nav Mis pólizas/Historial.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Vehículos / Personas | categorías (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Catálogo/elegibilidad real por cuenta; Exigibilidad fiscal específica por operación.

**Herramientas propuestas, no existentes/probadas aquí:** `get_service_options`, `get_task_requirements`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Catálogo real accesible sin completar una contratación.

**Pendiente:** No se recorrió la rama Personas ni se verificó exigibilidad fiscal al contratar.

### F38.2 — Seleccionar póliza y subtipo de vehículo

**Qué ocurre (observado):** Vehículos muestra Responsabilidad civil vehicular de Seguros Caracas con precio Desde. Abrir tarjeta presenta Particular/Pick-up/Rústico/Motos.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Póliza / proveedor | catálogo (observado) | usuario | desconocido (desconocido) |
| Particular / Pick-up / Rústico / Motos | catálogo (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Póliza y subtipo explícitos; Requisitos y condiciones vigentes del producto.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`.

**Confirmación:** no se documentó una confirmación posterior en este paso; cualquier mecanismo requerido deberá venir del contrato y del recorrido autorizado.

**Salida observada:** Se abrió la rama Particular.

**Pendiente:** Precio Desde no constituye una cotización final. Otros subtipos no se recorrieron.

### F38.3 — Comparar coberturas visibles sin adquirir

**Qué ocurre (observado):** Particular muestra R.C.V. BÁSICA, R.C.V. COMBINADO y R.C.V. COMBINADO + ASISTENCIA..., con prima USD y chevron. Adquirir gris sin selección.

| Input/acción (etiqueta o descripción de nota) | Tipo y procedencia | Fuente propuesta | Obligatoriedad y validación demostrada |
|---|---|---|---|
| Cobertura | catálogo con prima (observado) | usuario | desconocido (desconocido) |
| Adquirir | acción no ejecutada (observado) | usuario | desconocido (desconocido) |

**Qué necesita el agente (propuesto):** Cobertura elegida y condiciones canónicas; Cotización/elegibilidad verificadas; Datos/documentos del contratante que requiera el contrato real; Confirmación segura de contratación/pago.

**Herramientas propuestas, no existentes/probadas aquí:** `get_task_requirements`.

**Confirmación:** se propone flujo autenticado seguro antes de una escritura/acción sensible. La confirmación concreta posterior no se observó ni se ejecutó.

**Salida observada:** No se seleccionó cobertura ni adquirió póliza.

**Pendiente:** Campos posteriores, documentos, validación, emisión y pago desconocidos. Texto regulatorio visible no es validación independiente de cumplimiento.
