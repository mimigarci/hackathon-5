#!/usr/bin/env python3
"""Aprovisiona los agentes Wisi (voz femenina y masculina venezolanas) en
ElevenLabs Conversational AI con **client tools**.

Client tools = las ejecuta el navegador/app llamando al gateway WisiVoz. Así la
webapp funciona en local sin exponer el gateway con un túnel. El flujo seguro se
mantiene: `confirm_payment_in_app` dispara la confirmación biométrica en el cliente.

Escribe ELEVENLABS_AGENT_ID_FEMALE / _MALE en backend/.env.

Uso:
    cd backend && uv run python ../agent/provision_client_tools.py           # crea agentes
    cd backend && uv run python ../agent/provision_client_tools.py --update  # actualiza los de .env
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
AGENT_DIR = ROOT / "agent"
ENV_PATH = ROOT / "backend" / ".env"

# Voces venezolanas de alta calidad (modelo eleven_v4). Deben estar libres de
# "live moderation" para poder usarse en agentes (ElevenLabs lo exige).
VOICES = {
    "FEMALE": "9Ux14cxOYULytGFBVsW4",  # Clari - Natural, Clear (venezolana)
    "MALE": "STFMZniNPVEtF1Ug6b81",     # Miguel - Warm, Confident, Inspiring (venezolano)
}
TTS_MODEL = "eleven_v4"


def _p(obj: dict) -> dict:
    """Parámetro JSON Schema para una client tool."""
    return {"type": "object", **obj}


def client_tool(name: str, desc: str, props: dict, required: list[str], timeout: int = 20) -> dict:
    return {
        "type": "client",
        "name": name,
        "description": desc,
        "expects_response": True,
        "response_timeout_secs": timeout,
        "parameters": {"type": "object", "properties": props, "required": required},
    }


def s(desc: str) -> dict:
    return {"type": "string", "description": desc}


def i(desc: str) -> dict:
    return {"type": "integer", "description": desc}


def build_tools() -> list[dict]:
    return [
        client_tool("get_balance", "Consulta el saldo disponible del wallet.", {}, []),
        client_tool(
            "list_services",
            "Lista servicios pagables. Filtra por category (telefonia|electricidad|internet|condominio) o query.",
            {"category": s("Categoría del servicio"), "query": s("Texto a buscar")},
            [],
        ),
        client_tool(
            "explain_service",
            "Explica un servicio y qué datos hacen falta para pagarlo.",
            {"service_ref": s("Identificador del servicio"), "question": s("Pregunta del usuario")},
            ["service_ref"],
        ),
        client_tool("list_foundations", "Lista organizaciones para donar.", {}, []),
        client_tool(
            "prepare_payment",
            "Prepara (NO ejecuta) el pago de un servicio. Devuelve intent_id y resumen a confirmar.",
            {
                "service_ref": s("Identificador del servicio"),
                "account_number": s("Número de cuenta o contrato"),
                "amount_minor": i("Monto en céntimos; omitir para cotizar el pendiente"),
            },
            ["service_ref", "account_number"],
        ),
        client_tool(
            "prepare_parking",
            "Prepara el pago del ticket de estacionamiento desde el código del QR.",
            {"ticket_ref": s("Código leído del QR del ticket")},
            ["ticket_ref"],
        ),
        client_tool(
            "scan_parking_qr",
            "Abre el escáner QR de la app para leer el ticket de estacionamiento y devuelve el pago ya "
            "preparado (intent_id y monto). Úsala cuando el usuario quiera pagar el estacionamiento y no "
            "dicte el código del ticket.",
            {},
            [],
            timeout=90,
        ),
        client_tool(
            "list_movements",
            "Abre la pantalla de movimientos y devuelve las últimas operaciones del wallet.",
            {},
            [],
        ),
        client_tool(
            "list_catalog",
            "Lista opciones con precio de una sección: parquimetros (zonas, precio por hora), seguros "
            "(pólizas; type=vehiculos|personas), boleteria (eventos, precio por boleto) o tugruero (planes de grúa; "
            "type=vehiculos_m|vehiculos_a|moto_m|moto_a). Abre esa pantalla.",
            {
                "section": {"type": "string", "description": "Sección", "enum": ["parquimetros", "seguros", "boleteria", "tugruero"]},
                "type": s("Solo seguros: vehiculos o personas"),
            },
            ["section"],
        ),
        client_tool(
            "prepare_purchase",
            "Prepara (NO ejecuta) una compra del catálogo: parquímetro (quantity = horas, plate = placa), "
            "póliza de seguro, plan de TuGruero o boletos de un evento (quantity = boletos). El precio lo calcula el sistema.",
            {
                "product_ref": s("product_ref devuelto por list_catalog"),
                "quantity": i("Horas de parquímetro o número de boletos (1 si es seguro)"),
                "plate": s("Placa del vehículo, solo parquímetros"),
            },
            ["product_ref"],
        ),
        client_tool(
            "prepare_topup",
            "Prepara una recarga del wallet (Depositar). method: pago_movil, cuentas_nacionales, bdv o humaniz. "
            "Ofrécela cuando el saldo no alcance.",
            {
                "method": {"type": "string", "description": "Método de recarga", "enum": ["pago_movil", "cuentas_nacionales", "bdv", "humaniz"]},
                "amount_minor": i("Monto en céntimos"),
            },
            ["method", "amount_minor"],
        ),
        client_tool(
            "prepare_donation",
            "Prepara una donación a una organización.",
            {"foundation_ref": s("Identificador de la organización"), "amount_minor": i("Monto en céntimos")},
            ["foundation_ref", "amount_minor"],
        ),
        client_tool(
            "prepare_transfer",
            "Prepara un envío de fondos (p2p a usuario, p2c a comercio).",
            {
                "recipient_ref": s("Teléfono, @usuario o cédula del destino"),
                "amount_minor": i("Monto en céntimos"),
                "kind": {"type": "string", "description": "p2p o p2c", "enum": ["p2p", "p2c"]},
            },
            ["recipient_ref", "amount_minor"],
        ),
        client_tool(
            "get_operation_status",
            "Consulta el estado real de una operación enviada.",
            {"operation_ref": s("Referencia de la operación")},
            ["operation_ref"],
        ),
        client_tool(
            "create_support_case",
            "Abre un caso con Atención al Usuario.",
            {
                "category": s("Categoría del caso"),
                "summary": s("Resumen del problema"),
                "related_operation_ref": s("Operación relacionada (opcional)"),
            },
            ["category", "summary"],
        ),
        client_tool(
            "open_app_screen",
            "Navega a una pantalla de la app: home, pagar_servicios, parking, escaner_qr, donaciones, "
            "enviar_fondos, depositar, credirecto, escanear_creditos, parquimetros, seguros, boleteria, tugruero, jomi, movimientos, "
            "mis_pagos, notificaciones, racha, mis_vehiculos, mis_cuentas, asistencia o menu. "
            "credirecto y escanear_creditos abren el área de Créditos.",
            {"screen_key": s("Clave de la pantalla destino")},
            ["screen_key"],
        ),
        # Credirecto (simulado). El motor de reglas del gateway decide; Wisi solo
        # muestra la decisión y su motivo. Ver docs/creditos-contrato.md.
        client_tool(
            "get_credit_status",
            "Estado de Credirecto del usuario: nivel, disponible por línea, planes y próxima cuota.",
            {},
            [],
        ),
        client_tool(
            "answer_credit_question",
            "Responde preguntas sobre crédito con el texto oficial y los datos del motor: por qué se aprobó o "
            "rechazó una oferta, intereses, inicial, cuotas, requisitos, quién presta, atrasos, nivel y línea. "
            "Si matched es false, responde con lo que sepas sin inventar condiciones.",
            {"text": s("La pregunta del usuario, con sus palabras")},
            ["text"],
        ),
        client_tool(
            "build_credit_order",
            "Abre una opción de crédito con sus cuotas para armar la orden de compra a crédito. El usuario toca el botón; "
            "no se cobra nada y la orden se guarda en su navegador.",
            {"offer_id": s("offer_id devuelto por scan_credit_offers"), "installments": i("Número de cuotas")},
            ["offer_id"],
        ),
        client_tool(
            "scan_credit_offers",
            "Lista las opciones a crédito (SAGA, Conduce y Propiedash) y abre el área de Créditos.",
            {},
            [],
        ),
        client_tool(
            "quote_credit",
            "Simula las cuotas de una oferta. No guarda nada ni aprueba nada.",
            {"offer_id": s("Identificador de la oferta del escaneo"), "installments": i("Número de cuotas")},
            ["offer_id", "installments"],
        ),
        client_tool(
            "confirm_payment_in_app",
            "Pide a la app la confirmación segura (biometría/PIN) para un intent_id. SOLO la app ejecuta el dinero.",
            {"intent_id": s("Identificador de la intención a confirmar")},
            ["intent_id"],
            # El usuario necesita tiempo para leer y confirmar: con 20 s Wisi daba
            # por fallido un pago que sí salía.
            timeout=90,
        ),
    ]


# Corto: en una llamada cada segundo de saludo es espera. Se presenta como IA y avisa del PIN.
FIRST_MESSAGE = "¡Epa! Soy Wisi, tu asistente con IA. Nunca te pediré tu PIN. ¿Qué hacemos?"


# Palabras que el reconocimiento de voz debe esperar (marcas y servicios).
ASR_KEYWORDS = [
    "Wisi", "PagoDirecto", "Credirecto", "Corpoelec", "Digitel", "Movistar", "Movilnet", "CANTV",
    "Fundana", "SenosAyuda", "bolívares", "parquímetro", "boletería", "Pago Móvil", "Humaniz",
    "estacionamiento", "ticket", "recarga",
]


def agent_config(voice_id: str, prompt: str, tools: list[dict], llm: str = "gemini-2.5-flash") -> dict:
    return {
        "agent": {
            "first_message": FIRST_MESSAGE,
            "language": "es",
            "prompt": {
                "prompt": prompt,
                "llm": llm,
                "temperature": 0.3,
                "tools": tools,
            },
        },
        # El modelo escribe cifras (el chat las muestra) y ElevenLabs las lee en palabras.
        # Streaming optimizado y turnos que se cierran antes para responder rápido.
        "tts": {
            "voice_id": voice_id,
            "model_id": TTS_MODEL,
            "optimize_streaming_latency": 3,
            "stability": 0.55,
            "similarity_boost": 0.8,
            "speed": 1.0,
            "text_normalisation_type": "elevenlabs",
        },
        "asr": {"quality": "high", "keywords": ASR_KEYWORDS},
        "turn": {
            "turn_timeout": 20,
            "turn_eagerness": "eager",
            "speculative_turn": True,
            "soft_timeout_config": {"timeout_seconds": 2.5, "message": "Déjame ver..."},
        },
        "vad": {"background_voice_detection": True},
        "conversation": {"max_duration_seconds": 1800},
    }


def update_agent(h: dict, agent_id: str, voice_id: str, prompt: str, tools: list[dict]) -> None:
    url = f"https://api.elevenlabs.io/v1/convai/agents/{agent_id}"
    r = httpx.patch(url, headers=h, json={"conversation_config": agent_config(voice_id, prompt, tools)}, timeout=120)
    if r.status_code == 422:  # LLM no disponible en la cuenta: el anterior funciona
        print("  aviso:", r.text[:200])
        cfg = agent_config(voice_id, prompt, tools, llm="gemini-2.0-flash")
        r = httpx.patch(url, headers=h, json={"conversation_config": cfg}, timeout=120)
    r.raise_for_status()


def create_agent(h: dict, name: str, voice_id: str, prompt: str, tools: list[dict]) -> str:
    body = {"name": name, "conversation_config": agent_config(voice_id, prompt, tools)}
    r = httpx.post(
        "https://api.elevenlabs.io/v1/convai/agents/create",
        headers=h,
        json=body,
        timeout=60,
    )
    r.raise_for_status()
    return r.json()["agent_id"]


def write_env(key: str, value: str) -> None:
    text = ENV_PATH.read_text(encoding="utf-8")
    if re.search(rf"^{key}=.*$", text, flags=re.M):
        text = re.sub(rf"^{key}=.*$", f"{key}={value}", text, flags=re.M)
    else:
        text += f"\n{key}={value}\n"
    ENV_PATH.write_text(text, encoding="utf-8")


def main() -> int:
    load_dotenv(ENV_PATH)
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        print("Falta ELEVENLABS_API_KEY en backend/.env", file=sys.stderr)
        return 2
    h = {"xi-api-key": api_key, "Content-Type": "application/json"}
    prompt = (AGENT_DIR / "system_prompt.md").read_text(encoding="utf-8")
    tools = build_tools()

    if "--update" in sys.argv:
        for suffix, voice_id in VOICES.items():
            agent_id = os.environ.get(f"ELEVENLABS_AGENT_ID_{suffix}")
            if not agent_id:
                print(f"Falta ELEVENLABS_AGENT_ID_{suffix} en backend/.env", file=sys.stderr)
                return 2
            update_agent(h, agent_id, voice_id, prompt, tools)
            print(f"{suffix}: {agent_id} actualizado ({len(tools)} tools)")
        return 0

    for suffix, voice_id in VOICES.items():
        name = f"Wisi - PagoDirecto ({'femenina' if suffix == 'FEMALE' else 'masculina'})"
        agent_id = create_agent(h, name, voice_id, prompt, tools)
        write_env(f"ELEVENLABS_AGENT_ID_{suffix}", agent_id)
        print(f"{suffix}: {agent_id}  (voz {voice_id})")
    # compat: agente por defecto = femenino
    load_dotenv(ENV_PATH, override=True)
    write_env("ELEVENLABS_AGENT_ID", os.environ.get("ELEVENLABS_AGENT_ID_FEMALE", ""))
    print("IDs escritos en backend/.env")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
