// scan-label: recibe la foto de una bolsa de café y devuelve los datos de la etiqueta
// como JSON estructurado usando IA con visión (Gemini o Claude, ver _shared/ai.ts).
//
// Body: { images: [{ image_base64, media_type }] } (hasta 3: frente, dorso, etiqueta extra)
//       o { image_base64, media_type } (una foto, formato anterior). media_type: image/jpeg | image/png | image/webp
// Respuesta: { ok: true, data: ScanResult } | { ok: false, error: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { callStructured, corsHeaders, json } from "../_shared/ai.ts";

interface ScanResult {
  roaster_name: string | null;
  roaster_country: string | null;
  coffee_name: string | null;
  origin_country: string | null;
  region: string | null;
  farm: string | null;
  producer: string | null;
  variety: string | null;
  process: string | null;
  altitude_masl: number | null;
  sca_score: number | null;
  roast_level: string | null;
  roast_profile: "espresso" | "filtro" | "omni" | null;
  tasting_notes: string[];
  roast_date: string | null;
  weight_grams: number | null;
  confidence: "alta" | "media" | "baja";
  is_coffee_label: boolean;
  notes_for_user: string | null;
}

const SYSTEM = `Eres un experto en café de especialidad que lee etiquetas de bolsas de café.
Extrae únicamente lo que aparece escrito en la etiqueta. No inventes datos: si un campo no está, devuelve null.
Normaliza:
- roaster_country: país donde está la tostaduría, en español, si la etiqueta lo indica o se deduce con seguridad (ej. "Tostado en Santiago" → "Chile"; dirección o web .cl → "Chile"; "Roasted in Oslo" → "Noruega"). Si no hay señal, null.
- origin_country: nombre del país en español (ej. "Colombia", "Etiopía", "Brasil").
- process: usa términos estándar en español cuando aplique ("Lavado", "Natural", "Honey", "Anaeróbico", "Descafeinado", etc.). Si es una combinación, descríbela brevemente.
- roast_profile: "espresso", "filtro" u "omni" solo si la etiqueta lo indica (incluye sinónimos como "filter", "pour over", "espresso roast").
- tasting_notes: lista de notas de sabor tal como aparecen, en español si están en español, máximo 8.
- roast_date: formato YYYY-MM-DD. Si la etiqueta trae día y mes sin año (ej. "26/10", "TUESTE: 26-10"), asume el año en curso (si esa fecha quedara en el futuro, el año anterior). Si solo hay mes y año, usa el día 01. Hoy es ${new Date().toISOString().slice(0, 10)}.
- altitude_masl: número entero en metros; si es un rango, usa el promedio.
- sca_score: puntaje de taza SCA (escala 80-100, ej. "86.5 pts", "SCA 87", "Cupping score: 85.25", "puntaje 88") solo si la etiqueta lo indica explícitamente; número con hasta dos decimales. No confundir con porcentajes, gramos ni altura. Si no aparece, null.
- confidence: "alta" si la etiqueta se lee bien y los campos clave (tostador, origen) están claros; "media" si hay dudas; "baja" si la foto está borrosa o faltan datos clave.
- is_coffee_label: false si la imagen no es una etiqueta o bolsa de café.
- notes_for_user: una frase corta en español neutro si hay algo que el usuario debería revisar (ej. texto ilegible), si no, null.`;

const TOOL = {
  name: "registrar_etiqueta",
  description: "Registra los datos extraídos de la etiqueta de una bolsa de café",
  input_schema: {
    type: "object",
    properties: {
      roaster_name: { type: ["string", "null"] },
      roaster_country: { type: ["string", "null"] },
      coffee_name: { type: ["string", "null"] },
      origin_country: { type: ["string", "null"] },
      region: { type: ["string", "null"] },
      farm: { type: ["string", "null"] },
      producer: { type: ["string", "null"] },
      variety: { type: ["string", "null"] },
      process: { type: ["string", "null"] },
      altitude_masl: { type: ["integer", "null"] },
      sca_score: { type: ["number", "null"] },
      roast_level: { type: ["string", "null"] },
      roast_profile: {
        type: ["string", "null"],
        enum: ["espresso", "filtro", "omni", null],
      },
      tasting_notes: { type: "array", items: { type: "string" } },
      roast_date: { type: ["string", "null"] },
      weight_grams: { type: ["integer", "null"] },
      confidence: { type: "string", enum: ["alta", "media", "baja"] },
      is_coffee_label: { type: "boolean" },
      notes_for_user: { type: ["string", "null"] },
    },
    required: [
      "roaster_name",
      "roaster_country",
      "coffee_name",
      "origin_country",
      "region",
      "farm",
      "producer",
      "variety",
      "process",
      "altitude_masl",
      "sca_score",
      "roast_level",
      "roast_profile",
      "tasting_notes",
      "roast_date",
      "weight_grams",
      "confidence",
      "is_coffee_label",
      "notes_for_user",
    ],
  },
};

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Método no permitido" }, 405);
  }

  try {
    const body = await req.json();
    // Varias fotos (frente y dorso de la bolsa) o una sola (formato anterior).
    type Img = { image_base64?: unknown; media_type?: unknown };
    const raw: Img[] = Array.isArray(body?.images) && body.images.length
      ? body.images
      : [{ image_base64: body?.image_base64, media_type: body?.media_type }];
    if (raw.length > 3) {
      return json({ ok: false, error: "Máximo 3 fotos por escaneo" }, 400);
    }
    const images: { data: string; media_type: string }[] = [];
    for (const im of raw) {
      const data = im?.image_base64;
      const media_type = typeof im?.media_type === "string" ? im.media_type : "image/jpeg";
      if (!data || typeof data !== "string") {
        return json({ ok: false, error: "Falta image_base64" }, 400);
      }
      if (!ALLOWED_TYPES.has(media_type)) {
        return json({ ok: false, error: `media_type no soportado: ${media_type}` }, 400);
      }
      // ~5 MB en base64
      if (data.length > 7_000_000) {
        return json({ ok: false, error: "Imagen demasiado grande (máx ~5 MB)" }, 413);
      }
      images.push({ data, media_type });
    }

    const data = await callStructured<ScanResult>({
      system: SYSTEM,
      content: [
        ...images.map((im) => ({
          type: "image" as const,
          source: { type: "base64" as const, media_type: im.media_type, data: im.data },
        })),
        {
          type: "text",
          text:
            images.length > 1
              ? `Estas ${images.length} fotos son de la misma bolsa de café (distintas caras o etiquetas). Combina la información de todas y registra los datos.`
              : "Lee esta etiqueta de café y registra los datos.",
        },
      ],
      tool: TOOL,
      maxTokens: 4096,
    });

    return json({ ok: true, data });
  } catch (err) {
    console.error("scan-label error", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return json({ ok: false, error: message }, 500);
  }
});
