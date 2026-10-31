import { useCallback, useMemo, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { Gateway, bs, type ToolResponse, type WisiSession } from "./gateway";

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:8000";

interface Line {
  who: "user" | "wisi" | "sys";
  text: string;
}

export function App() {
  const gw = useMemo(() => new Gateway(GATEWAY_URL), []);
  const [session, setSession] = useState<WisiSession | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const pendingIntent = useRef<string | null>(null);

  const say = useCallback(
    (who: Line["who"], text: string) => setLines((l) => [...l, { who, text }]),
    [],
  );

  // --- confirmación segura: la dispara la app/UI, nunca el modelo ----------
  const confirmInApp = useCallback(
    async (intentId: string): Promise<boolean> => {
      const ok = window.confirm(
        "PagoDirecto: confirma esta operación con tu biometría/PIN.\n(demostración: Aceptar = biometría válida)",
      );
      if (!ok) {
        say("sys", "Confirmación cancelada por el usuario.");
        return false;
      }
      const proof = await gw.approvalProof(intentId);
      const r = await gw.confirm(intentId, proof);
      say("wisi", r.speech ?? "Operación procesada.");
      if (r.status === "ok") setBalance((r.data["balance_minor"] as number) ?? null);
      return r.status === "ok";
    },
    [gw, say],
  );

  // --- sesión de voz con ElevenLabs ----------------------------------------
  const conversation = useConversation({
    clientTools: {
      confirm_payment_in_app: async (params: { intent_id: string }) => {
        const okp = await confirmInApp(params.intent_id);
        return okp ? "ok" : "denied";
      },
    },
    onConnect: () => say("sys", "Voz conectada."),
    onDisconnect: () => say("sys", "Voz finalizada."),
    onMessage: (m: { source: string; message: string }) => {
      say(m.source === "user" ? "user" : "wisi", m.message);
    },
    onError: (e: unknown) => say("sys", `Error de voz: ${String(e)}`),
  });

  const start = useCallback(async () => {
    const s = await gw.createSession();
    setSession(s);
    const b = await gw.balance();
    setBalance((b.data["balance_minor"] as number) ?? null);
    say("sys", `Sesión lista para ${s.principal}. Voz: ${s.voice_enabled ? "sí" : "no (configura ElevenLabs)"}.`);
    say("wisi", "¡Hola! Soy Wisi. ¿Qué necesitas: pagar un servicio, el estacionamiento, donar o enviar fondos?");
  }, [gw, say]);

  const startVoice = useCallback(async () => {
    if (!session?.signed_url) {
      say("sys", "Voz no disponible: falta configurar ELEVENLABS_AGENT_ID/API_KEY en el gateway.");
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({ signedUrl: session.signed_url });
    } catch (e) {
      say("sys", `No se pudo iniciar la voz: ${String(e)}`);
    }
  }, [conversation, session, say]);

  // --- acciones demo (modo chat/botón, sin voz) ----------------------------
  const afterPrepare = useCallback(
    async (r: ToolResponse) => {
      say("wisi", r.speech ?? "Preparado.");
      const intent = r.data["intent_id"] as string | undefined;
      if (r.status === "requires_confirmation" && intent) {
        pendingIntent.current = intent;
        await confirmInApp(intent);
      }
    },
    [confirmInApp, say],
  );

  const demo = {
    saldo: async () => {
      const r = await gw.balance();
      setBalance((r.data["balance_minor"] as number) ?? null);
      say("wisi", r.speech ?? "");
    },
    servicios: async () => say("wisi", (await gw.services()).speech ?? ""),
    pagarLuz: async () =>
      afterPrepare(await gw.preparePayment("corpoelec", "0001-2345", 18000)),
    estacionamiento: async () =>
      afterPrepare(await gw.prepareParking("TICKET-ABC-123")),
    donar: async () => afterPrepare(await gw.prepareDonation("fundana", 5000)),
    enviar: async () => afterPrepare(await gw.prepareTransfer("@maria", 25000)),
  };

  return (
    <div className="app">
      <header>
        <div className="avatar">W</div>
        <div>
          <h1>Wisi · consola demo</h1>
          <small>
            {session ? `${session.principal}` : "sin sesión"}
            {balance !== null ? ` · ${bs(balance)}` : ""}
          </small>
        </div>
      </header>

      {!session ? (
        <button className="primary big" onClick={start}>
          Iniciar sesión demo
        </button>
      ) : (
        <>
          <div className="controls">
            <button className="primary" onClick={startVoice}>🎙️ Hablar con Wisi</button>
            <button onClick={demo.saldo}>Saldo</button>
            <button onClick={demo.servicios}>Servicios</button>
            <button onClick={demo.pagarLuz}>Pagar luz</button>
            <button onClick={demo.estacionamiento}>Estacionamiento</button>
            <button onClick={demo.donar}>Donar</button>
            <button onClick={demo.enviar}>Enviar fondos</button>
          </div>

          <div className="chat">
            {lines.map((l, i) => (
              <div key={i} className={`line ${l.who}`}>
                {l.text}
              </div>
            ))}
          </div>
        </>
      )}
      <footer>
        Gateway: <code>{GATEWAY_URL}</code> · El agente nunca ejecuta dinero: la
        confirmación pasa por biometría/PIN en la app.
      </footer>
    </div>
  );
}
