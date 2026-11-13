// Inyecta meta tags Open Graph en las fichas públicas (/r/:slug y /c/:id) y en /unete para que WhatsApp,
// Instagram, iMessage y similares muestren título, descripción y foto al compartir el enlace.
// La SPA no puede hacerlo sola porque esos bots no ejecutan JavaScript.
//
// Lee Supabase con la clave pública (RLS: solo recetas publicadas y cafés del catálogo).
// Si algo falla, devuelve el index.html sin cambios.

import type { Config, Context } from "https://edge.netlify.com";

const SUPABASE_URL = Netlify.env.get("VITE_SUPABASE_URL") ?? "";
const SUPABASE_KEY = Netlify.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";
const PHOTOS_BUCKET = "coffee-photos";

interface Meta {
  title: string;
  description: string;
  image: string | null;
  type: string;
}

export default async (req: Request, context: Context) => {
  const res = await context.next();
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return res;

  const url = new URL(req.url);
  let meta: Meta | null = null;
  try {
    meta = await buildMeta(url);
  } catch (e) {
    console.error("og edge function", e);
  }
  if (!meta) return res;

  const html = await res.text();
  const image = meta.image ?? `${url.origin}/hero.jpg`;
  const tags = [
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:url" content="${esc(url.origin + url.pathname)}" />`,
    `<meta property="og:type" content="${meta.type}" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    `<title>${esc(meta.title)}</title>`,
  ].join("\n    ");

  // Quita las etiquetas por defecto que vamos a reemplazar y el <title> original.
  const cleaned = html
    .replace(/<meta property="og:(title|description|image|type|url)"[^>]*>\s*/g, "")
    .replace(/<meta name="twitter:card"[^>]*>\s*/g, `<meta name="twitter:card" content="summary_large_image" />\n    `)
    .replace(/<title>[^<]*<\/title>/, "");
  const out = cleaned.replace("</head>", `    ${tags}\n  </head>`);

  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(out, { status: res.status, headers });
};

async function buildMeta(url: URL): Promise<Meta | null> {
  // Entrada a la beta: es el enlace de las campañas (WhatsApp a clientes de Tostado Club).
  if (url.pathname.replace(/\/$/, "") === "/unete") {
    return {
      title: "Únete a Dripo",
      description: "Tu diario de café de especialidad: escanea la etiqueta, guarda lo que tomas y recibe recetas a medida.",
      image: null,
      type: "website",
    };
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const [kind, id] = parts;

  if (kind === "r") {
    const r = await one(`featured_recipes?slug=eq.${encodeURIComponent(id)}&select=title,author,event,dripper,params,story,photo_path`);
    if (!r) return null;
    const dose = r.params?.dose_g ? `${r.params.dose_g} g` : null;
    const description = truncate(
      [r.author, r.event, r.dripper, dose].filter(Boolean).join(" · ") + (r.story ? `. ${r.story}` : ""),
      200,
    );
    return { title: `${r.title} · Dripo`, description, image: photo(r.photo_path), type: "article" };
  }

  if (kind === "c") {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const c = await one(`coffees?id=eq.${id}&is_published=eq.true&select=name,origin_country,region,process,variety,tasting_notes,photo_path,roaster:roasters(name,country)`);
    if (!c) return null;
    const bits = [
      [c.origin_country, c.region].filter(Boolean).join(", "),
      c.process,
      c.variety,
      Array.isArray(c.tasting_notes) && c.tasting_notes.length ? `Notas: ${c.tasting_notes.slice(0, 4).join(", ")}` : null,
    ].filter(Boolean);
    return {
      title: `${c.name}${c.roaster?.name ? ` · ${c.roaster.name}` : ""} · Dripo`,
      description: truncate(bits.join(" · ") || "Café de especialidad en Dripo.", 200),
      image: photo(c.photo_path),
      type: "article",
    };
  }
  return null;
}

// deno-lint-ignore no-explicit-any
async function one(query: string): Promise<any | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, accept: "application/json" },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function photo(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${PHOTOS_BUCKET}/${path}`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const config: Config = {
  path: ["/r/*", "/c/*", "/unete"],
  onError: "bypass",
};
