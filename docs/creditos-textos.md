# Textos de respuesta de Credirecto

Lo que contesta Wisi a las preguntas de crédito, sin pasar por un modelo de lenguaje. El crédito solo arma órdenes de compra de planes de SAGA. El código está en [`worker/src/credit-texts.ts`](../worker/src/credit-texts.ts). Ejemplos con el perfil demo.

| Tema | Pregunta | Respuesta |
| --- | --- | --- |
| Qué es | ¿Qué es Credirecto? | Credirecto te deja armar una orden de compra a crédito para los planes de SAGA, en cuotas. La encuentras en Funciones, en Créditos. |
| SAGA | ¿Qué es SAGA en el crédito? | SAGA centraliza tu compra: reúne los planes y tu orden. La línea para viajes es de Pago Directo; en esta demo no interviene ningún banco. |
| La orden | ¿Cómo armo una orden? | Eliges un plan de SAGA y tus cuotas, y armas la orden de compra en el área de Créditos. No se cobra nada y queda guardada en este navegador, también en tus Movimientos. Si borras los datos del navegador, se pierde. |
| Quién decide | ¿Quién aprueba mi crédito? | Decide un motor de reglas, no Wisi ni la inteligencia artificial: mira tus pagos a tiempo, si tienes cuotas vencidas y tu línea disponible. Siempre te mostramos el motivo. |
| Línea | ¿Cuánto me prestan de crédito? | Tu línea para viajes es de Bs 3.000,00. Lo que ya tengas en órdenes lo ves descontado en el área de Créditos. |
| Intereses | ¿El crédito tiene intereses? | En esta demo, las cuotas de los planes de SAGA van sin intereses ni comisión. |
| Inicial | ¿De cuánto es la inicial? | Con tu nivel Turista, la inicial es del 40 % del plan. La orden la indica, pero al armarla no se cobra. |
| Cuotas | ¿Cuántas cuotas tiene el crédito? | Los planes de SAGA van de 2 a 4 cuotas quincenales. Ves cada fecha y monto antes de armar la orden. |
| Pagar | ¿Cómo pago mi cuota? | En esta demo no se cobran cuotas: la orden muestra sus fechas y montos como referencia. |
| Requisitos | ¿Qué requisitos pide el crédito? | Para los planes de SAGA necesitas 6 pagos a tiempo, ninguna cuota vencida y que lo financiado quepa en tu línea para viajes. |
| Seguridad | Me piden el PIN | Nunca te pedimos tu PIN ni tu clave por chat ni por teléfono, y Wisi no te llama. Si alguien te los pide, no se los des. |
| Simulación | ¿Este crédito es real? | Es una simulación: los planes, los montos y las órdenes son de ejemplo y no se mueve dinero real. |
| Fuera de SAGA | ¿Por qué me rechazaron el crédito del carro? | Por ahora el crédito es solo para los planes de SAGA: Los Roques, Mérida y Margarita. Para eso no armamos órdenes. |
| Sin rechazos | ¿Por qué me rechazaron el crédito? | Ahora mismo no tienes ningún crédito rechazado: 3 planes de SAGA están disponibles. ¿Cuál te interesa? |
| Plan disponible | ¿Por qué me rechazaron Los Roques? | No está rechazado. Los Roques: 3 días con posada y traslados está disponible: financias Bs 2.880,00 con una inicial de Bs 1.920,00 (40 %), y cabe en tu línea de turismo disponible de Bs 3.000,00. Elige tus cuotas y armas la orden con SAGA. |
| Plan bloqueado (con cuota vencida) | ¿Por qué me rechazaron Mérida? | Mérida: posada y experiencia de montaña todavía está por desbloquear. Tienes una cuota vencida. Ponte al día para volver a usar Credirecto. |
