# Verificación del corte de Home

## Realizado

- Lectura estática del Home, sus callbacks y widgets, modelos Dart, interfaz de repositorio, consultas Supabase, servicio del asistente y esquema SQL en el commit documentado.
- Comparación de las seis tarjetas con notas del recorrido Android mediante REA. Los cuatro análisis son parciales; Boletería y Donaciones no tienen formulario observado.
- Revisión visual de las seis imágenes publicadas: formularios/catálogos sin valores personales de la sesión. Se excluyen capturas de Home/perfil, datos fiscales, datos bancarios precargados, propiedades y mapas potencialmente sensibles.
- Parseo de todos los JSON/JSONL incorporados; conteos de tareas/pasos/entradas; unicidad de IDs de tarea y pasos; presencia de claves requeridas de la estructura.
- Comprobación de referencias de notas y pantallas, digest SHA-256 de imágenes compartidas y ausencia de herramientas marcadas como invocadas.
- Revisión de ausencia de rutas personales, APKs, AVD, credenciales y archivos de sesión en los archivos añadidos. El código existente del repositorio no se modifica.

## Límites

No se ejecutó una validación completa de JSON Schema 2020-12: no hay validador instalado. Las comprobaciones estructurales no equivalen a esa validación. No se ejecutó Flutter ni se probó una app desplegada para esta revisión de documentación.

No se probaron pagos, acreditaciones, afiliaciones, mandatos, emisión de pólizas, envío de solicitudes a terceros ni barreras/parquímetros. No hay evidencia de contratos privados o de reglas de servidor. Una sola versión y sesión no demuestran disponibilidad global.

El PR agrega documentación y evidencia seleccionada. No habilita funcionalidades nuevas ni acredita cobertura operativa del agente.
