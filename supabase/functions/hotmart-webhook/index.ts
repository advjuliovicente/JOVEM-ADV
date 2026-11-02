// Webhook da Hotmart (versão 2.0.0) -> libera ou bloqueia o acesso à plataforma.
//
// Segredos (Supabase > Edge Functions > Secrets):
//   HOTMART_HOTTOK      token de verificação da Hotmart (Ferramentas > Webhook > Autenticação)   [obrigatório]
//   HOTMART_PRODUCT_ID  ID do produto na Hotmart; eventos de outros produtos são ignorados          [opcional]
//   SITE_URL            endereço da plataforma, para onde o e-mail de convite leva                  [opcional]
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SITE_URL = Deno.env.get("SITE_URL") || "https://advjuliovicente.github.io/JOVEM-ADV/";
const HOTTOK = Deno.env.get("HOTMART_HOTTOK") || "";
const PRODUCT_ID = (Deno.env.get("HOTMART_PRODUCT_ID") || "").trim();

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// evento da Hotmart -> status da assinatura
const STATUS: Record<string, string> = {
  PURCHASE_APPROVED: "ativa",
  PURCHASE_COMPLETE: "ativa",
  PURCHASE_DELAYED: "atrasada",
  PURCHASE_CANCELED: "cancelada",
  SUBSCRIPTION_CANCELLATION: "cancelada",
  PURCHASE_REFUNDED: "reembolsada",
  PURCHASE_CHARGEBACK: "chargeback",
  PURCHASE_PROTEST: "chargeback",
  PURCHASE_EXPIRED: "expirada",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function toDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const d = typeof v === "number" ? new Date(v) : new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  if (!HOTTOK) return json({ erro: "Configure o segredo HOTMART_HOTTOK no Supabase." }, 500);

  const raw = await req.text();
  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ erro: "Corpo não é JSON." }, 400); }

  const url = new URL(req.url);
  const token = req.headers.get("x-hotmart-hottok") || url.searchParams.get("hottok") || body?.hottok || "";
  if (!safeEqual(String(token), HOTTOK)) return json({ erro: "Hottok inválido." }, 401);

  const evento: string = body?.event || "DESCONHECIDO";
  const data = body?.data || {};
  const id: string = String(body?.id || (await sha256(raw)));

  // já processado? (a Hotmart reenvia quando não recebe 200)
  const { data: ja } = await admin.from("eventos_hotmart").select("id").eq("id", id).maybeSingle();
  if (ja) return json({ ok: true, repetido: true });

  const email = String(
    data?.buyer?.email || data?.subscriber?.email || data?.user?.email || data?.subscription?.user?.email || "",
  ).trim().toLowerCase();
  const nome = data?.buyer?.name || data?.subscriber?.name || data?.user?.name || null;
  const produto = String(data?.product?.id || data?.subscription?.product?.id || "");

  const registrar = (resultado: Record<string, unknown>) =>
    admin.from("eventos_hotmart").insert({ id, evento, email: email || null, payload: body, resultado });

  if (PRODUCT_ID && produto && produto !== PRODUCT_ID) {
    await registrar({ ignorado: "outro produto" });
    return json({ ok: true, ignorado: "outro produto" });
  }

  const novo = STATUS[evento];
  if (!novo || !email) {
    const motivo = novo ? "sem e-mail" : "evento sem efeito no acesso";
    await registrar({ ignorado: motivo });
    return json({ ok: true, ignorado: motivo });
  }

  // data do evento na Hotmart: um evento mais antigo nunca sobrescreve um mais novo
  const eventoEm = toDate(body?.creation_date) ?? new Date().toISOString();
  const cancelouAssinatura = evento === "SUBSCRIPTION_CANCELLATION";

  const { data: aplicado, error: upErr } = await admin.rpc("aplicar_evento_hotmart", {
    p_email: email,
    p_status: novo,
    p_evento: evento,
    p_evento_em: eventoEm,
    p_nome: nome,
    p_produto: produto || null,
    p_transacao: data?.purchase?.transaction || null,
    p_assinante: data?.subscription?.subscriber?.code || data?.subscriber?.code || null,
    // cancelamento: acesso até o fim do período pago; PURCHASE_CANCELED mantém a data que já existir; demais zeram
    p_define_acesso: evento !== "PURCHASE_CANCELED",
    p_acesso_ate: cancelouAssinatura
      ? toDate(data?.date_next_charge) ?? toDate(data?.subscription?.date_next_charge)
      : null,
  });
  if (upErr) return json({ erro: "Falha ao gravar assinatura", detalhe: upErr.message }, 500);

  if (aplicado === null) {
    await registrar({ ignorado: "evento mais antigo que o status atual" });
    return json({ ok: true, ignorado: "evento mais antigo que o status atual" });
  }

  // compra aprovada: cria a conta e envia o e-mail para o aluno definir a senha
  let convite = "nao_necessario";
  if (novo === "ativa") {
    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: SITE_URL,
      data: nome ? { nome } : undefined,
    });
    if (!invErr) convite = "enviado";
    else if (/already|registered|exists/i.test(invErr.message)) convite = "conta_existente";
    else convite = "falhou: " + invErr.message;
  }

  await registrar({ status: aplicado, convite });
  return json({ ok: true, email, status: aplicado, convite });
});
