# Contrato: Credirecto y el cerebro de Wisi

31 oct 2026 · Andrés · contrato compartido entre el Worker (`worker/src/`) y la webapp (`backend/app/static/`). Todo es **simulado**: no hay dinero real, ni bancos, ni envío de datos a aliados.

## 1. Perfil demo y reglas del motor

El motor vive en `worker/src/credit.ts` (funciones puras). Wisi y el modelo de lenguaje nunca deciden: solo muestran lo que el motor responde, con su motivo.

Perfil del usuario demo (constante): nivel `Turista`, 8 pagos a tiempo, 4 meses de uso y ninguna cuota vencida.

| Piso | Qué cubre | Quién fondea | Regla para el demo |
| --- | --- | --- | --- |
| 1. Cotidiano | Servicios, estacionamiento, boletería, TuGruero, Seguros Mercantil | Pago Directo | Es la **misma línea «día a día» de la wallet** (`CREDIT_LIMIT_MINOR`, `credit_used`): Turista Bs 2.000, Explorador Bs 4.000 (×2), Embajador Bs 8.000 (×4). Lo que financia el escáner suma a lo usado de esa línea, y los abonos de la wallet lo reducen. Sin inicial. 1 o 2 cuotas, a 7 y 14 días. 0 % de interés en el demo. Se aprueba si el precio cabe en lo disponible |
| 2. Turismo | Planes de SAGA y hospedajes de Estei | Pago Directo con un tope bajo | Pide 6 pagos a tiempo o más. Turista: inicial del 40 % y hasta Bs 3.000 financiados. Explorador: 20 % y hasta Bs 6.000. Cuotas quincenales: 2, 3 o 4. 0 % de interés en el demo. Tiene su propia línea, aparte del piso 1 |
| 3. Patrimonio | Vehículos de Conduce e inmuebles de Propiedash | Banco aliado (Bancamiga o Mercantil) | Pago Directo no presta: precalifica y arma la solicitud. Pide 3 meses de uso y ninguna cuota vencida. Montos en US$ y referenciales. Vehículo: inicial del 30 %, de 36 a 60 meses. Inmueble: inicial del 20 %, de 120 a 240 meses |

Cualquier piso se rechaza si hay una cuota vencida. Cada respuesta trae `reason` en español, por ejemplo «Aprobado: Bs 1.200,00 cabe en tu línea disponible de Bs 2.000,00».

Las cuotas se reparten en partes iguales en céntimos, y el resto va a la última. Las fechas salen de la fecha actual del Worker: el piso 1 suma 7 y 14 días, y el piso 2 suma 15 días por cuota.

### Catálogo (ejemplos simulados)

| `offer_id` | Piso | `vertical` | `partner` | Título | Moneda | `price_minor` |
| --- | --- | --- | --- | --- | --- | --- |
| `svc_condominio` | 1 | servicios | Pago Directo | Condominio de noviembre | VES | 120000 |
| `svc_cantv` | 1 | servicios | Pago Directo | CANTV: internet y teléfono | VES | 26000 |
| `park_month` | 1 | estacionamiento | Pago Directo | Tus tickets de estacionamiento del mes | VES | 30000 |
| `event_ticket` | 1 | boleteria | Pago Directo | Entrada a un concierto en el Poliedro | VES | 90000 |
| `tugruero_plan` | 1 | asistencia_vial | TuGruero | Plan anual de grúa y asistencia vial | VES | 110000 |
| `mercantil_rcv` | 1 | seguros | Seguros Mercantil | Póliza RCV para tu carro | VES | 140000 |
| `saga_roques` | 2 | turismo | SAGA | Los Roques: 3 días con posada y traslados | VES | 480000 |
| `saga_merida` | 2 | turismo | SAGA | Mérida: posada y experiencia de montaña | VES | 260000 |
| `estei_margarita` | 2 | hospedaje | Estei | Margarita: 2 noches de hospedaje | VES | 180000 |
| `conduce_corolla` | 3 | vehiculo | Conduce | Toyota Corolla 2019 | USD | 1450000 |
| `propiedash_apto` | 3 | inmueble | Propiedash | Apartamento de 2 habitaciones en Caracas | USD | 4800000 |

## 2. Endpoints del Worker

Todos son `POST` con `Authorization: Bearer <session_token>`. Todos responden `ToolResponse` (`request_id`, `status`, `data`, `error`, `speech`). También se exponen como herramientas en `/api/tool/<nombre>`.

| Ruta | Herramienta | Cuerpo | `data` |
| --- | --- | --- | --- |
| `/api/credit/status` | `get_credit_status` | `{}` | `level`, `ontime_payments`, `months_active`, `overdue`, `lines: { cotidiano: {limit_minor, used_minor, available_minor}, turismo: {…} }`, `plans: Plan[]`, `next_installment: {plan_id, title, due_date, amount_minor} \| null` |
| `/api/credit/scan` | `scan_credit_offers` | `{}` | `offers: Offer[]`, `summary: {disponible, precalificado, por_desbloquear}`. El `speech` resume cuántas hay por piso |
| `/api/credit/quote` | `quote_credit` | `{offer_id, installments}` | `offer_id`, `eligible`, `reason`, `down_payment_minor`, `financed_minor`, `installments: [{n, due_date, amount_minor}]`, `total_minor`, `interest_minor: 0`, `currency`. No guarda nada |
| `/api/credit/prepare` | `prepare_credit_offer` | `{offer_id, installments}` | Solo pisos 1 y 2 con estado `disponible` o `precalificado`. Devuelve `status: "requires_confirmation"` y `{intent_id, summary, ttl_seconds}` |
| `/api/credit/precalify` | `precalify_credit` | `{offer_id}` | Solo piso 3: `request_ref`, `bank_options`, `documents`, `estimated: {down_payment_pct, term_months}`. El `speech` aclara que es una simulación y que no se envió nada a ningún banco |

El `summary` de `prepare_credit_offer` es `{title, partner, offer_id, piso, amount_minor, financed_minor, installments, total_minor}`. `amount_minor` es **la inicial**: lo que sale hoy de la Wallet, que puede ser 0. La webapp usa `amount_minor` en la hoja de confirmación como lo que se descuenta del saldo.

`Offer` = `{offer_id, piso, vertical, partner, title, detail, currency, price_minor, status ("disponible" | "precalificado" | "por_desbloquear"), down_payment_pct, down_payment_minor, financed_minor, installments_options, frequency ("semanal" | "quincenal" | "mensual"), funder, reason, next_step ("usar" | "precalificar" | "subir_nivel"), action_label}`.

`Plan` = `{plan_id, offer_id, title, partner, piso, financed_minor, installments: [{n, due_date, amount_minor, paid}], created_at}`.

**Confirmación.** Se usa el `/api/confirm` de siempre. Para una intención de tipo `credit_offer` (no confundir con `credit`, el desembolso de efectivo de la wallet, que suma al saldo), `Wallet.execute`:

- descuenta la inicial del saldo (y la rechaza si no alcanza);
- vuelve a comprobar en ese mismo momento que lo financiado cabe en lo disponible de su línea;
- suma lo financiado a lo usado (piso 1: `credit_used`, la línea de la wallet; piso 2: la línea de turismo) y guarda el plan.

Una intención ya `submitted` se reproduce (misma operación) y nunca se debita dos veces, sea del tipo que sea.

La respuesta `ok` trae `balance_minor`, `operation_ref` y `plan_id`, y el `speech` dice «Listo, Credirecto aprobado…». Una intención que ya se ejecutó no se vuelve a ejecutar, con ninguna prueba.

**Errores nuevos:** `offer_not_found`, `invalid_installments`, `credit_rejected` (con `error.message` igual al motivo), `credit_over_limit` y `bank_channel` (cuando se piden `prepare` para el piso 3).

## 3. El cerebro de Wisi: `/api/brain`

`POST /api/brain` recibe `{text, screen?}` y devuelve `ToolResponse` con `data: {tier, action, params, reply, model?, cost_usd?}`. Las normas completas están en [wisi-cerebro.md](wisi-cerebro.md).

`action` es una de estas: `saldo`, `movimientos`, `pagar_servicio`, `estacionamiento`, `donar`, `enviar`, `creditos_escanear`, `credito_ver`, `credito_explicar`, `abrir_pantalla`, `conversar`.

`params` puede traer `service_ref`, `account_number`, `amount_minor`, `recipient_ref`, `foundation_ref`, `offer_id`, `vertical` o `screen_key`. Cualquier otra acción o parámetro se descarta. Una acción que mueve dinero solo prepara: la confirmación siempre ocurre en la app, con la hoja de huella.
