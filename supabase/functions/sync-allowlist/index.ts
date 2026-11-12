// sync-allowlist: recibe correos de clientes de Tostado Club y los agrega a public.allowlist.
// Idempotente (upsert por email). La llama el flujo de n8n "[Prod] Dripo <- Klaviyo · Lista blanca"
// a diario con los perfiles del segmento de Klaviyo "compró al menos una vez" (Shopify sincroniza
// los pedidos a Klaviyo, así no hace falta una app en Shopify).
//
// Auth: header `x-sync-key` igual al secret SYNC_KEY (no usa JWT de usuario).
// Body: { emails: string[] } (hasta 2.000 por llamada)
// Respuesta: { ok: true, data: { received, valid, inserted } } | { ok: false, error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);
  const syncKey = Deno.env.get("SYNC_KEY");
  if (!syncKey || req.headers.get("x-sync-key") !== syncKey) return json({ ok: false, error: "No autorizado" }, 401);

  let body: { emails?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Body inválido" }, 400);
  }
  const raw = Array.isArray(body.emails) ? body.emails : [];
  if (raw.length > 2000) return json({ ok: false, error: "Máximo 2.000 correos por llamada" }, 400);
  const seen = new Set<string>();
  for (const e of raw) {
    if (typeof e !== "string") continue;
    const email = e.trim().toLowerCase();
    if (EMAIL_RE.test(email) && email.length <= 254) seen.add(email);
  }
  const rows = [...seen].map((email) => ({ email, source: "klaviyo" }));

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ ok: false, error: "Función sin configurar" }, 500);
  const admin = createClient(url, key, { auth: { persistSession: false } });

  let inserted = 0;
  if (rows.length) {
    const { data, error } = await admin.from("allowlist").upsert(rows, { onConflict: "email", ignoreDuplicates: true }).select("email");
    if (error) {
      console.error("sync-allowlist", error.message);
      return json({ ok: false, error: error.message }, 500);
    }
    inserted = data?.length ?? 0;
  }
  console.log(`sync-allowlist ok: ${raw.length} recibidos, ${rows.length} válidos, ${inserted} nuevos`);
  return json({ ok: true, data: { received: raw.length, valid: rows.length, inserted } });
});
