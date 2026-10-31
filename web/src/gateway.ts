// Cliente del gateway WisiVoz para la consola web.

export type WisiStatus =
  | "ok"
  | "pending"
  | "requires_confirmation"
  | "denied"
  | "unavailable"
  | "error";

export interface ToolResponse {
  request_id: string;
  status: WisiStatus;
  data: Record<string, unknown>;
  error: { code: string; message: string } | null;
  speech: string | null;
}

export interface WisiSession {
  session_token: string;
  principal: string;
  elevenlabs_agent_id: string;
  signed_url: string | null;
  voice_enabled: boolean;
}

export class Gateway {
  private token: string | null = null;

  constructor(private baseUrl: string) {}

  async createSession(principal = "demo-user"): Promise<WisiSession> {
    const r = await fetch(
      `${this.baseUrl}/api/session?principal=${encodeURIComponent(principal)}`,
      { method: "POST" },
    );
    const s = (await r.json()) as WisiSession;
    this.token = s.session_token;
    return s;
  }

  private headers(): HeadersInit {
    return {
      "Content-Type": "application/json",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  balance = () => this.get("/api/balance");
  services = () => this.post("/api/services", {});

  preparePayment = (service_ref: string, account_number: string, amount_minor?: number) =>
    this.post("/api/payment/prepare", { service_ref, account_number, amount_minor });

  prepareParking = (ticket_ref: string) =>
    this.post("/api/parking/prepare", { ticket_ref });

  prepareDonation = (foundation_ref: string, amount_minor: number) =>
    this.post("/api/donation/prepare", { foundation_ref, amount_minor });

  prepareTransfer = (recipient_ref: string, amount_minor: number, kind = "p2p") =>
    this.post("/api/transfer/prepare", { recipient_ref, amount_minor, kind });

  confirm = (intent_id: string, approval_proof: string) =>
    this.post("/api/confirm", { intent_id, approval_proof });

  async approvalProof(intent_id: string, factor = "biometric"): Promise<string> {
    const r = await fetch(
      `${this.baseUrl}/api/approval-proof?intent_id=${intent_id}&factor=${factor}`,
      { method: "POST", headers: this.headers() },
    );
    const j = (await r.json()) as { approval_proof: string };
    return j.approval_proof;
  }

  private async get(path: string): Promise<ToolResponse> {
    const r = await fetch(`${this.baseUrl}${path}`, { headers: this.headers() });
    return (await r.json()) as ToolResponse;
  }

  private async post(path: string, body: unknown): Promise<ToolResponse> {
    const r = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return (await r.json()) as ToolResponse;
  }
}

export const bs = (minor: number): string =>
  `Bs ${(minor / 100).toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
