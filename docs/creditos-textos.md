# Textos de respuesta de Credirecto

Lo que contesta Wisi a las preguntas de crédito, sin pasar por un modelo de lenguaje. El código está en [`worker/src/credit-texts.ts`](../worker/src/credit-texts.ts); los montos y motivos salen del motor, así que cambian con el estado de cada usuario. Ejemplos con el perfil demo: nivel Turista, sin deudas.

| Tema | Pregunta | Respuesta |
| --- | --- | --- |
| Qué es | ¿Qué es Credirecto? | Credirecto es tu crédito dentro de Pago Directo. Puedes pasar efectivo a tu wallet, pagar el día a día en cuotas, financiar viajes y precalificar para carro o casa con un banco aliado. Tú confirmas siempre con tu huella. |
| Quién decide | ¿Quién aprueba mi crédito? | Decide un motor de reglas, no Wisi ni la inteligencia artificial: mira tus pagos a tiempo, tus meses de uso, si tienes cuotas vencidas y tu línea disponible. Siempre te mostramos el motivo. |
| Quién presta | ¿Quién presta el crédito? | Depende de la oferta. En el día a día y en viajes te presta Pago Directo. En carro y casa, Pago Directo no presta: te precalifica y decide un banco aliado, Bancamiga o Mercantil. |
| Cuánto tengo | ¿Cuánto me prestan de crédito? | Tienes Bs 2.000,00 disponibles de Bs 2.000,00 para el día a día, y Bs 3.000,00 de Bs 3.000,00 para viajes. Carro y casa los evalúa un banco aliado. |
| Intereses | ¿El crédito tiene intereses? | En esta demo, las cuotas del día a día y de viajes van sin intereses ni comisión. En carro y casa, las condiciones las pone el banco aliado. |
| Inicial | ¿De cuánto es la inicial? | Depende del piso. En el día a día no hay inicial. En viajes, con tu nivel Turista, es del 40 %. En carro es del 30 % y en casa del 20 %. La inicial sale de tu saldo al confirmar. |
| Cuotas | ¿Cuántas cuotas tiene el crédito? | Depende del crédito. Efectivo a tu wallet: 4 cuotas quincenales. Día a día: 1 o 2 semanales. Viajes: de 2 a 4 quincenales. Carro: de 36 a 60 meses. Casa: de 120 a 240 meses. |
| Pagar | ¿Cómo pago mi cuota? | No tienes cuotas pendientes de tus planes. Si pides crédito, verás cada fecha antes de confirmar y pagarás desde Credirecto con tu saldo. |
| Requisitos | ¿Qué requisitos pide el crédito? | Para el día a día basta con tener línea disponible y ninguna cuota vencida. Viajes pide 6 pagos a tiempo. Carro y casa piden 3 meses de uso, y para el banco: cédula, RIF, constancia de ingresos, estados de cuenta de 3 meses y la cotización del carro o el documento del inmueble. |
| Atrasos | ¿Qué pasa si no pago una cuota? | Mientras tengas una cuota vencida no podrás usar Credirecto ni precalificar. En cuanto te pongas al día, se vuelve a abrir. En esta demo no se cobra mora. |
| Nivel | ¿Cómo subo de nivel para más línea de crédito? | Hoy estás en nivel Turista, con Bs 2.000,00 para el día a día y Bs 3.000,00 para viajes. Con los niveles superiores la línea crece, hasta el doble en Explorador. En esta demo el nivel no cambia. |
| Seguridad | Me piden el PIN del crédito | Nunca te pedimos tu PIN ni tu clave por chat ni por teléfono, y Wisi no te llama. Si alguien te los pide, no se los des: las operaciones solo se confirman con tu huella dentro de la app. |
| Simulación | ¿Este crédito es real? | Es una simulación: los montos, las ofertas y las aprobaciones son de ejemplo y no se mueve dinero real. |
| Rechazo sin oferta | ¿Por qué me rechazaron el crédito? | Ahora mismo no tienes ningún crédito rechazado: 9 ofertas están disponibles y 2 precalificadas. ¿Cuál te interesa? |
| Oferta precalificada | ¿Por qué me rechazaron el crédito del carro? | No está rechazado. Toyota Corolla 2019 está precalificado: con una inicial de US$ 4.350,00 (30 %) financiarías US$ 10.150,00 con un banco aliado (Bancamiga o Mercantil). Es referencial: Pago Directo no presta y el banco decide. El banco aliado decide; nosotros armamos la solicitud. |
| Oferta disponible | ¿Por qué me aprobaron el condominio? | Condominio de noviembre está disponible con Credirecto: Bs 1.200,00 cabe en tu línea disponible de Bs 2.000,00. Pago Directo es quien te presta. |
| Oferta bloqueada (con cuota vencida) | ¿Por qué me rechazaron Los Roques? | Los Roques: 3 días con posada y traslados todavía está por desbloquear. Tienes una cuota vencida. Ponte al día para volver a usar Credirecto. |
