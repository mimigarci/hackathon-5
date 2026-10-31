"""Datos ficticios para el modo mock. Sin PII real, sin secretos.

Reproducen las entidades que el backend real de PagoDirecto expone (servicios,
fundaciones, wallet) para poder ejercitar el flujo completo sin tocar producción.
"""
from __future__ import annotations

# Catálogo de servicios pagables (mapea a /customer/services/information).
SERVICES = [
    {"service_ref": "digitel", "name": "Digitel", "category": "telefonia", "needs_account": True, "sample_pending_minor": 450_00},
    {"service_ref": "movilnet", "name": "Movilnet", "category": "telefonia", "needs_account": True, "sample_pending_minor": 210_00},
    {"service_ref": "movistar", "name": "Movistar", "category": "telefonia", "needs_account": True, "sample_pending_minor": 320_00},
    {"service_ref": "simpletv", "name": "SimpleTV", "category": "tv", "needs_account": True, "sample_pending_minor": 380_00},
    {"service_ref": "inter", "name": "Inter", "category": "internet", "needs_account": True, "sample_pending_minor": 420_00},
    {"service_ref": "cantv", "name": "CANTV (internet/teléfono)", "category": "internet", "needs_account": True, "sample_pending_minor": 260_00},
    {"service_ref": "corpoelec", "name": "Corpoelec (luz)", "category": "electricidad", "needs_account": True, "sample_pending_minor": 180_00},
    {"service_ref": "thundernet", "name": "ThunderNet", "category": "internet", "needs_account": True, "sample_pending_minor": 340_00},
    {"service_ref": "tugruero", "name": "TuGruero", "category": "asistencia", "needs_account": True, "sample_pending_minor": 550_00},
    {"service_ref": "dlm", "name": "DLM", "category": "asistencia", "needs_account": True, "sample_pending_minor": 300_00},
    {"service_ref": "globalsystem", "name": "Global System GPS", "category": "asistencia", "needs_account": True, "sample_pending_minor": 280_00},
    {"service_ref": "starmoviles", "name": "StarMoviles Corp.", "category": "telefonia", "needs_account": True, "sample_pending_minor": 240_00},
    {"service_ref": "fibex", "name": "FIBEX", "category": "internet", "needs_account": True, "sample_pending_minor": 390_00},
    {"service_ref": "jomi", "name": "Jomi", "category": "hogar", "needs_account": True, "sample_pending_minor": 0},
    {"service_ref": "condominio", "name": "Condominio", "category": "condominio", "needs_account": True, "sample_pending_minor": 1200_00},
]

# Fundaciones para donar (mapea a /donations/foundations).
FOUNDATIONS = [
    {"foundation_ref": "fundana", "name": "Fundana"},
    {"foundation_ref": "senosayuda", "name": "SenosAyuda"},
    {"foundation_ref": "banco_alimentos", "name": "Banco de Alimentos de Caracas"},
]

# Wallet inicial del usuario demo (en céntimos de Bs).
INITIAL_WALLET_BALANCE_MINOR = 5_000_00

# ---- Catálogo de demostración (precios ficticios, rotulados como demo) -------
# Los montos los decide el servidor: el cliente o el modelo solo eligen el
# producto y la cantidad.

# Parquímetros: tarifa por hora de cada zona.
PARKING_ZONES = [
    {"product_ref": "pq_centro", "name": "Zona Centro", "detail": "Calles del casco central", "price_minor": 15_00, "unit": "hora"},
    {"product_ref": "pq_norte", "name": "Zona Norte", "detail": "Avenidas comerciales", "price_minor": 12_00, "unit": "hora"},
    {"product_ref": "pq_este", "name": "Zona Este", "detail": "Zona residencial", "price_minor": 10_00, "unit": "hora"},
]

# Seguros: póliza mensual por tipo (vehículos / personas).
INSURANCE = [
    {"product_ref": "sg_rcv_auto", "name": "RCV Particular", "type": "vehiculos", "detail": "Responsabilidad civil para tu carro", "price_minor": 320_00, "unit": "mes"},
    {"product_ref": "sg_rcv_moto", "name": "RCV Moto", "type": "vehiculos", "detail": "Responsabilidad civil para tu moto", "price_minor": 180_00, "unit": "mes"},
    {"product_ref": "sg_accidentes", "name": "Accidentes personales", "type": "personas", "detail": "Gastos médicos por accidente", "price_minor": 150_00, "unit": "mes"},
    {"product_ref": "sg_salud", "name": "Salud básica", "type": "personas", "detail": "Consultas y emergencias", "price_minor": 450_00, "unit": "mes"},
]

# Boletería: eventos de demostración (precio por boleto).
EVENTS = [
    {"product_ref": "ev_gaitas", "name": "Noche de gaitas", "detail": "Sáb 21 nov · 8:00 p. m.", "price_minor": 250_00, "unit": "boleto"},
    {"product_ref": "ev_standup", "name": "Stand-up comedy", "detail": "Vie 27 nov · 9:00 p. m.", "price_minor": 180_00, "unit": "boleto"},
    {"product_ref": "ev_beisbol", "name": "Béisbol: juego de temporada", "detail": "Dom 29 nov · 5:00 p. m.", "price_minor": 120_00, "unit": "boleto"},
]

TOW_PLANS = [
    {"product_ref": "tg_v_classic_m", "name": "Classic mensual", "type": "vehiculos_m", "detail": "Grúa y auxilio vial básico", "price_minor": 120_00, "unit": "mes"},
    {"product_ref": "tg_v_plus_m", "name": "Plus mensual", "type": "vehiculos_m", "detail": "Más kilómetros de grúa y auxilio", "price_minor": 190_00, "unit": "mes"},
    {"product_ref": "tg_v_gold_m", "name": "Gold mensual", "type": "vehiculos_m", "detail": "Cobertura máxima y servicios ilimitados", "price_minor": 280_00, "unit": "mes"},
    {"product_ref": "tg_v_classic_a", "name": "Classic anual", "type": "vehiculos_a", "detail": "Grúa y auxilio vial básico", "price_minor": 1_200_00, "unit": "año"},
    {"product_ref": "tg_v_plus_a", "name": "Plus anual", "type": "vehiculos_a", "detail": "Más kilómetros de grúa y auxilio", "price_minor": 1_900_00, "unit": "año"},
    {"product_ref": "tg_v_gold_a", "name": "Gold anual", "type": "vehiculos_a", "detail": "Cobertura máxima y servicios ilimitados", "price_minor": 2_800_00, "unit": "año"},
    {"product_ref": "tg_m_moto_m", "name": "Moto mensual", "type": "moto_m", "detail": "Asistencia vial para tu moto", "price_minor": 90_00, "unit": "mes"},
    {"product_ref": "tg_m_retro_m", "name": "Retro mensual", "type": "moto_m", "detail": "Motos clásicas", "price_minor": 110_00, "unit": "mes"},
    {"product_ref": "tg_m_moto_a", "name": "Moto anual", "type": "moto_a", "detail": "Asistencia vial para tu moto", "price_minor": 900_00, "unit": "año"},
    {"product_ref": "tg_m_retro_a", "name": "Retro anual", "type": "moto_a", "detail": "Motos clásicas", "price_minor": 1_100_00, "unit": "año"},
]

CATALOG = {"parquimetros": PARKING_ZONES, "seguros": INSURANCE, "boleteria": EVENTS, "tugruero": TOW_PLANS}
# Tipo de operación del ledger según la sección del catálogo.
CATALOG_KIND = {"parquimetros": "parking_meter", "seguros": "insurance", "boleteria": "tickets", "tugruero": "tow_plan"}
MAX_QUANTITY = {"parquimetros": 8, "seguros": 1, "boleteria": 6, "tugruero": 1}

# Métodos de recarga (Depositar) que ofrece la app.
TOPUP_METHODS = {
    "cuentas_nacionales": "Cuentas Nacionales",
    "pago_movil": "Pago Móvil",
    "bdv": "Banco de Venezuela",
    "humaniz": "Humaniz",
}
MAX_TOPUP_MINOR = 10_000_00

# Credirecto: línea de crédito de demostración, pagadera en 4 cuotas.
CREDIT_LIMIT_MINOR = 2_000_00
CREDIT_INSTALLMENTS = 4
