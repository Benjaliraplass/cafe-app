// join: ingreso a la beta por invitación (pública, sin sesión).
//
// Body: { email: string, ref?: string }
// Respuesta: { ok: true, data: { status: "invited" | "waitlist" | "exists" } } | { ok: false, error }
//
// Decide con la RPC join_decision (service role):
//   exists    -> ya tiene cuenta: la app lo manda a entrar.
//   allowlist -> cliente de Tostado Club: se crea la cuenta y se envía el correo "Te invitaron a Dripo".
//   invite    -> llegó con el código de un usuario con cupo: igual, y queda invited_by.
//   waitlist  -> queda en lista de espera.
// El correo de invitación es la plantilla "Invite user" de Supabase y lleva a /nueva-contrasena.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ALLOWED_ORIGINS = ["https://dripocoffee.com", "http://localhost:5173"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);

  let body: { email?: unknown; ref?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Body inválido" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const ref = typeof body.ref === "string" ? body.ref.trim().slice(0, 10) : null;
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ ok: false, error: "Correo inválido" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ ok: false, error: "Función sin configurar" }, 500);
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await admin.rpc("join_decision", { p_email: email, p_ref: ref });
  if (error) {
    console.error("join_decision", error.message);
    return json({ ok: false, error: "No pudimos procesar tu correo. Intenta de nuevo." }, 500);
  }
  const row = Array.isArray(data) ? data[0] : data;
  const status = row?.status as string | undefined;
  const inviter = (row?.inviter as string | null) ?? null;

  if (status === "exists") return json({ ok: true, data: { status: "exists" } });
  if (status === "waitlist") return json({ ok: true, data: { status: "waitlist" } });

  // allowlist | invite: crear la cuenta y mandar el correo.
  const origin = req.headers.get("origin") ?? "";
  const site = ALLOWED_ORIGINS.includes(origin) ? origin : "https://dripocoffee.com";
  const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${site}/nueva-contrasena`,
    data: { invited_by: inviter, source: status === "invite" ? "invite" : "tostado" },
  });
  if (invErr) {
    console.error("inviteUserByEmail", invErr.message);
    // La cuenta ya existía (carrera) -> tratar como existente.
    if (/already|registered|exists/i.test(invErr.message)) return json({ ok: true, data: { status: "exists" } });
    return json({ ok: false, error: "No pudimos enviar el correo. Intenta de nuevo." }, 500);
  }
  console.log(`join ok: ${status}${inviter ? " via " + inviter.slice(0, 8) : ""}`);
  return json({ ok: true, data: { status: "invited" } });
});
