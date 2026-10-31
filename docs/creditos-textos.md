# Textos de respuesta de Credirecto

Lo que contesta Wisi a las preguntas de crédito, sin pasar por un modelo de lenguaje. El crédito solo arma órdenes de compra de tres opciones en dólares: SAGA, Conduce y Propiedash. El código está en [`worker/src/credit-texts.ts`](../worker/src/credit-texts.ts). Ejemplos con el perfil demo.

| Tema | Pregunta | Respuesta |
| --- | --- | --- |
| Qué es | ¿Qué es Credirecto? | Credirecto te deja armar una orden de compra a crédito: Los Roques con SAGA, un carro con Conduce o un apartamento con Propiedash. La encuentras en Funciones, en Créditos. |
| La orden | ¿Cómo armo una orden? | Eliges una opción y tus cuotas, y armas la orden de compra en el área de Créditos. No se cobra nada y queda guardada en este navegador, también en tus Movimientos. Si borras los datos del navegador, se pierde. |
| Quién presta | ¿Quién presta el crédito? | Los Roques con SAGA va con tu línea de Pago Directo para viajes. El carro con Conduce y el apartamento con Propiedash los financia un banco aliado, Bancamiga o Mercantil, que es quien decide. |
| Quién decide | ¿Quién aprueba mi crédito? | Decide un motor de reglas, no Wisi ni la inteligencia artificial: mira tus pagos a tiempo, si tienes cuotas vencidas y tu línea disponible. Siempre te mostramos el motivo. |
| Línea | ¿Cuánto me prestan de crédito? | Tu línea para viajes es de US$ 300,00. Lo que ya tengas en órdenes lo ves descontado en el área de Créditos. El carro y el apartamento los evalúa un banco aliado. |
| Intereses | ¿El crédito tiene intereses? | En esta demo, las cuotas de SAGA van sin intereses ni comisión. En el carro y el apartamento, las condiciones las pone el banco aliado. |
| Inicial | ¿De cuánto es la inicial? | Con tu nivel Turista, la inicial es del 40 % en Los Roques, del 30 % en el carro y del 20 % en el apartamento. La orden la indica, pero al armarla no se cobra. |
| Cuotas | ¿Cuántas cuotas tiene el crédito? | Los Roques va de 2 a 4 cuotas quincenales, el carro de 36 a 60 meses y el apartamento de 120 a 240 meses. Ves los montos antes de armar la orden. |
| Pagar | ¿Cómo pago mi cuota? | En esta demo no se cobran cuotas: la orden muestra sus fechas y montos como referencia. |
| Requisitos | ¿Qué requisitos pide el crédito? | Para Los Roques necesitas 6 pagos a tiempo, ninguna cuota vencida y que lo financiado quepa en tu línea para viajes. El carro y el apartamento piden 3 meses de uso y ninguna cuota vencida. |
| Seguridad | Me piden el PIN | Nunca te pedimos tu PIN ni tu clave por chat ni por teléfono, y Wisi no te llama. Si alguien te los pide, no se los des. |
| Simulación | ¿Este crédito es real? | Es una simulación: las opciones, los montos y las órdenes son de ejemplo y no se mueve dinero real. |
| Fuera del catálogo | ¿Hay crédito para el condominio? | Por ahora puedes armar órdenes a crédito de tres opciones: Los Roques con SAGA, un carro con Conduce y un apartamento con Propiedash. |
| Sin rechazos | ¿Por qué me rechazaron el crédito? | Ahora mismo no tienes ningún crédito rechazado: tienes 3 opciones para armar tu orden. ¿Cuál te interesa? |
| SAGA | ¿Por qué me rechazaron Los Roques? | No está rechazado. Los Roques: 3 días con posada y traslados está disponible: financias US$ 288,00 con una inicial de US$ 192,00 (40 %), y cabe en tu línea de turismo disponible de US$ 300,00. Elige tus cuotas y arma la orden. |
| Conduce | ¿Por qué me rechazaron el crédito del carro? | No está rechazado. Toyota Corolla 2019 está precalificado: con una inicial de US$ 4.350,00 (30 %) financiarías US$ 10.150,00 con un banco aliado (Bancamiga o Mercantil). Es referencial: Pago Directo no presta y el banco decide. Puedes armar la orden; el banco aliado decide. |
| Propiedash | ¿Por qué me aprobaron el apartamento? | Apartamento de 2 habitaciones en Caracas está precalificado: con una inicial de US$ 9.600,00 (20 %) financiarías US$ 38.400,00 con un banco aliado (Bancamiga o Mercantil). Es referencial: Pago Directo no presta y el banco decide. Puedes armar la orden; el banco aliado decide. |
| Con cuota vencida | ¿Por qué me rechazaron Los Roques? | Los Roques: 3 días con posada y traslados todavía está por desbloquear. Tienes una cuota vencida. Ponte al día para volver a usar Credirecto. |
