// sync-allowlist: copia a public.allowlist el correo de todo cliente de Shopify con al menos una
// compra. Idempotente (upsert por email). La corre pg_cron a diario (ver migración) o un admin a mano.
//
// Auth: header `x-sync-key` igual al secreto `sync_key` de Vault (RPC public.sync_key, solo service role).
// Secrets: SHOPIFY_SHOP (ej. tostadoclub.myshopify.com), SHOPIFY_ADMIN_TOKEN (app personalizada con
//          read_customers).
// Respuesta: { ok: true, data: { fetched, inserted, pages, ms } } | { ok: false, error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const API_VERSION = "2026-10";
const PAGE = 250;
const QUERY = `query($first: Int!, $after: String) {
  customers(first: $first, after: $after, query: "orders_count:>0", sortKey: ID) {
    pageInfo { hasNextPage endCursor }
    nodes { defaultEmailAddress { emailAddress } }
  }
}`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ ok: false, error: "Función sin configurar" }, 500);
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: syncKey } = await admin.rpc("sync_key");
  if (!syncKey || req.headers.get("x-sync-key") !== syncKey) return json({ ok: false, error: "No autorizado" }, 401);

  const shop = Deno.env.get("SHOPIFY_SHOP");
  const token = Deno.env.get("SHOPIFY_ADMIN_TOKEN");
  if (!shop || !token) return json({ ok: false, error: "Faltan secrets (SHOPIFY_SHOP, SHOPIFY_ADMIN_TOKEN)" }, 500);
  const started = Date.now();
  let after: string | null = null;
  let pages = 0;
  let fetched = 0;
  let inserted = 0;
  const batch: { email: string }[] = [];

  async function flush() {
    if (!batch.length) return;
    const rows = batch.splice(0, batch.length);
    const { data, error } = await admin.from("allowlist").upsert(rows, { onConflict: "email", ignoreDuplicates: true }).select("email");
    if (error) throw new Error(error.message);
    inserted += data?.length ?? 0;
  }

  try {
    do {
      const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
        method: "POST",
        headers: { "content-type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query: QUERY, variables: { first: PAGE, after } }),
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      if (!res.ok) throw new Error(`Shopify ${res.status}`);
      const body = await res.json();
      if (body.errors?.length) throw new Error(body.errors[0].message);
      const conn = body.data.customers;
      pages += 1;
      for (const n of conn.nodes as { defaultEmailAddress: { emailAddress: string | null } | null }[]) {
        const email = n.defaultEmailAddress?.emailAddress?.trim().toLowerCase();
        if (email && email.includes("@")) {
          fetched += 1;
          batch.push({ email });
        }
      }
      if (batch.length >= 500) await flush();
      after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
    } while (after);
    await flush();
  } catch (e) {
    console.error("sync-allowlist", e instanceof Error ? e.message : e);
    return json({ ok: false, error: e instanceof Error ? e.message : "Error" }, 500);
  }

  const ms = Date.now() - started;
  console.log(`sync-allowlist ok: ${fetched} correos, ${inserted} nuevos, ${pages} páginas, ${ms} ms`);
  return json({ ok: true, data: { fetched, inserted, pages, ms } });
});
