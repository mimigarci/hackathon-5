"""Datos ficticios para el modo mock. Sin PII real, sin secretos.

Reproducen las entidades que el backend real de PagoDirecto expone (servicios,
fundaciones, wallet) para poder ejercitar el flujo completo sin tocar producción.
"""
from __future__ import annotations

# Catálogo de servicios pagables (mapea a /customer/services/information).
SERVICES = [
    {
        "service_ref": "digitel",
        "name": "Digitel",
        "category": "telefonia",
        "needs_account": True,
        "sample_pending_minor": 450_00,
    },
    {
        "service_ref": "movistar",
        "name": "Movistar",
        "category": "telefonia",
        "needs_account": True,
        "sample_pending_minor": 320_00,
    },
    {
        "service_ref": "movilnet",
        "name": "Movilnet",
        "category": "telefonia",
        "needs_account": True,
        "sample_pending_minor": 210_00,
    },
    {
        "service_ref": "corpoelec",
        "name": "Corpoelec (luz)",
        "category": "electricidad",
        "needs_account": True,
        "sample_pending_minor": 180_00,
    },
    {
        "service_ref": "cantv",
        "name": "CANTV (internet/teléfono)",
        "category": "internet",
        "needs_account": True,
        "sample_pending_minor": 260_00,
    },
    {
        "service_ref": "condominio",
        "name": "Condominio",
        "category": "condominio",
        "needs_account": True,
        "sample_pending_minor": 1_200_00,
    },
]

# Fundaciones para donar (mapea a /donations/foundations).
FOUNDATIONS = [
    {"foundation_ref": "fundana", "name": "Fundana"},
    {"foundation_ref": "senosayuda", "name": "SenosAyuda"},
    {"foundation_ref": "banco_alimentos", "name": "Banco de Alimentos de Caracas"},
]

# Wallet inicial del usuario demo (en céntimos de Bs).
INITIAL_WALLET_BALANCE_MINOR = 2_500_00
