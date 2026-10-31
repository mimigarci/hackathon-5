"""Pruebas del flujo intención -> confirmación -> ejecución, con los controles
del fintech-agent-decision-kit: idempotencia, expiración, saldo, aislamiento por
usuario, y que el modelo no pueda ejecutar dinero."""
from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    # ledger limpio por test
    from app import ledger as ledger_mod

    importlib.reload(ledger_mod)
    import app.tools as tools_mod
    import app.main as main_mod

    importlib.reload(tools_mod)
    importlib.reload(main_mod)
    return TestClient(main_mod.app)


def _auth(client):
    r = client.post("/api/session", params={"principal": "u1"})
    return {"Authorization": f"Bearer {r.json()['session_token']}"}


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_balance_requires_auth(client):
    assert client.get("/api/balance").status_code == 401


def test_full_payment_flow(client):
    h = _auth(client)
    bal0 = client.get("/api/balance", headers=h).json()["data"]["balance_minor"]

    prep = client.post(
        "/api/payment/prepare",
        headers=h,
        json={"service_ref": "digitel", "account_number": "04141234567", "amount_minor": 10000},
    ).json()
    assert prep["status"] == "requires_confirmation"
    intent_id = prep["data"]["intent_id"]

    proof = client.post(
        "/api/approval-proof", headers=h, params={"intent_id": intent_id}
    ).json()["approval_proof"]

    conf = client.post(
        "/api/confirm", headers=h, json={"intent_id": intent_id, "approval_proof": proof}
    ).json()
    assert conf["status"] == "ok"
    assert conf["data"]["state"] == "settled"
    assert conf["data"]["balance_minor"] == bal0 - 10000


def test_idempotency_same_proof_no_double_charge(client):
    h = _auth(client)
    prep = client.post(
        "/api/payment/prepare",
        headers=h,
        json={"service_ref": "corpoelec", "account_number": "123", "amount_minor": 5000},
    ).json()
    iid = prep["data"]["intent_id"]
    proof = client.post(
        "/api/approval-proof", headers=h, params={"intent_id": iid}
    ).json()["approval_proof"]

    first = client.post(
        "/api/confirm", headers=h, json={"intent_id": iid, "approval_proof": proof}
    ).json()
    second = client.post(
        "/api/confirm", headers=h, json={"intent_id": iid, "approval_proof": proof}
    ).json()
    assert first["data"]["operation_ref"] == second["data"]["operation_ref"]
    assert second["data"]["replayed"] is True
    # el saldo solo bajó una vez
    assert first["data"]["balance_minor"] == second["data"]["balance_minor"]


def test_expired_intent_is_rejected(client):
    from app.ledger import ledger

    h = _auth(client)
    # intención ya caducada (ttl=0) creada directamente en el ledger
    intent = ledger.create_intent(
        kind="payment",
        principal="u1",
        amount_minor=5000,
        currency="VES",
        details={"service": "CANTV"},
        ttl_seconds=0,
    )
    proof = client.post(
        "/api/approval-proof", headers=h, params={"intent_id": intent.intent_id}
    ).json()["approval_proof"]
    conf = client.post(
        "/api/confirm",
        headers=h,
        json={"intent_id": intent.intent_id, "approval_proof": proof},
    ).json()
    assert conf["status"] == "denied"
    assert conf["error"]["code"] == "intent_expired"


def test_insufficient_funds(client):
    h = _auth(client)
    prep = client.post(
        "/api/transfer/prepare",
        headers=h,
        json={"recipient_ref": "@bob", "amount_minor": 999_999_00, "kind": "p2p"},
    ).json()
    iid = prep["data"]["intent_id"]
    proof = client.post(
        "/api/approval-proof", headers=h, params={"intent_id": iid}
    ).json()["approval_proof"]
    conf = client.post(
        "/api/confirm", headers=h, json={"intent_id": iid, "approval_proof": proof}
    ).json()
    assert conf["status"] == "denied"
    assert conf["error"]["code"] == "insufficient_funds"


def test_model_cannot_execute_money(client):
    """No existe webhook tool de confirmación para el modelo."""
    assert client.post("/el/tools/confirm_and_execute").status_code == 404


def test_webhook_tool_requires_secret(client):
    from app.config import settings

    # sin secreto compartido -> 401
    assert client.post("/el/tools/get_balance").status_code == 401
    # con el secreto configurado y principal -> ok
    r = client.post(
        "/el/tools/get_balance",
        headers={
            "x-wisivoz-tool-secret": settings.tool_webhook_secret,
            "x-wisivoz-principal": "u1",
        },
    )
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_cross_user_intent_denied(client):
    h1 = _auth(client)
    prep = client.post(
        "/api/payment/prepare",
        headers=h1,
        json={"service_ref": "digitel", "account_number": "1", "amount_minor": 1000},
    ).json()
    iid = prep["data"]["intent_id"]
    # otro usuario intenta confirmar la intención ajena
    r2 = client.post("/api/session", params={"principal": "attacker"})
    h2 = {"Authorization": f"Bearer {r2.json()['session_token']}"}
    proof = client.post(
        "/api/approval-proof", headers=h2, params={"intent_id": iid}
    ).json()["approval_proof"]
    conf = client.post(
        "/api/confirm", headers=h2, json={"intent_id": iid, "approval_proof": proof}
    ).json()
    assert conf["status"] == "denied"
    assert conf["error"]["code"] == "forbidden"


def test_movements_after_confirm(client):
    h = _auth(client)
    empty = client.post("/api/tool/list_movements", headers=h, json={}).json()
    assert empty["status"] == "ok" and empty["data"]["movements"] == []

    prep = client.post(
        "/api/tool/prepare_parking", headers=h, json={"ticket_ref": "TCK-48213"}
    ).json()
    intent_id = prep["data"]["intent_id"]
    proof = client.post(
        "/api/approval-proof", headers=h, params={"intent_id": intent_id}
    ).json()["approval_proof"]
    conf = client.post(
        "/api/confirm", headers=h, json={"intent_id": intent_id, "approval_proof": proof}
    ).json()
    assert conf["status"] == "ok" and "ticket pagado" in conf["speech"]

    movs = client.post("/api/tool/list_movements", headers=h, json={}).json()["data"]["movements"]
    assert len(movs) == 1
    assert movs[0]["kind"] == "parking"
    assert movs[0]["title"] == "Estacionamiento · TCK-48213"
    assert movs[0]["amount_minor"] == -prep["data"]["summary"]["amount_minor"]


def _confirm(client, h, intent_id):
    proof = client.post(
        "/api/approval-proof", headers=h, params={"intent_id": intent_id}
    ).json()["approval_proof"]
    return client.post(
        "/api/confirm", headers=h, json={"intent_id": intent_id, "approval_proof": proof}
    ).json()


def test_topup_credits_balance_and_shows_as_income(client):
    h = _auth(client)
    bal0 = client.post("/api/tool/get_balance", headers=h, json={}).json()["data"]["balance_minor"]
    prep = client.post(
        "/api/tool/prepare_topup", headers=h, json={"method": "pago_movil", "amount_minor": 100000}
    ).json()
    assert prep["status"] == "requires_confirmation"
    conf = _confirm(client, h, prep["data"]["intent_id"])
    assert conf["data"]["balance_minor"] == bal0 + 100000
    movs = client.post("/api/tool/list_movements", headers=h, json={}).json()["data"]["movements"]
    assert movs[0]["amount_minor"] == 100000 and movs[0]["title"] == "Recarga · Pago Móvil"
    too_much = client.post(
        "/api/tool/prepare_topup", headers=h, json={"method": "pago_movil", "amount_minor": 10**9}
    ).json()
    assert too_much["status"] == "denied"


def test_purchase_amount_is_decided_by_server(client):
    h = _auth(client)
    prep = client.post(
        "/api/tool/prepare_purchase", headers=h,
        json={"product_ref": "ev_gaitas", "quantity": 3, "amount_minor": 1},
    ).json()
    assert prep["data"]["summary"]["amount_minor"] == 3 * 25000
    capped = client.post(
        "/api/tool/prepare_purchase", headers=h, json={"product_ref": "pq_centro", "quantity": 99}
    ).json()
    assert capped["data"]["summary"]["quantity"] == 8


def test_credit_line_disburses_and_respects_limit(client):
    h = _auth(client)
    bal0 = client.post("/api/tool/get_balance", headers=h, json={}).json()["data"]["balance_minor"]
    prep = client.post("/api/tool/prepare_credit", headers=h, json={"amount_minor": 150000}).json()
    conf = _confirm(client, h, prep["data"]["intent_id"])
    assert conf["status"] == "ok" and conf["data"]["balance_minor"] == bal0 + 150000
    credit = client.post("/api/tool/get_credit", headers=h, json={}).json()["data"]
    assert credit["used_minor"] == 150000 and credit["available_minor"] == 50000
    over = client.post("/api/tool/prepare_credit", headers=h, json={"amount_minor": 60000}).json()
    assert over["status"] == "denied"
    pay = client.post("/api/tool/prepare_credit_payment", headers=h, json={"amount_minor": 50000}).json()
    _confirm(client, h, pay["data"]["intent_id"])
    assert client.post("/api/tool/get_credit", headers=h, json={}).json()["data"]["used_minor"] == 100000
