// suggest-recipe: dado un café (opcional), una familia de método, un dripper, la cantidad
// y preferencias, devuelve una receta específica con parámetros y pasos, generada por IA
// (Gemini o Claude, ver _shared/ai.ts).
//
// Body: {
//   coffee?: { name, roaster_name, origin_country, region, farm, variety, process, altitude_masl,
//              roast_level, roast_profile, tasting_notes, roast_date } | null,
//   coffee_description?: string,     // texto libre si no hay café escaneado ("Etiopía natural tueste claro")
//   method_family: "conico" | "flat" | "inmersion" | "espresso",
//   dripper: string,                 // ej. "V60", "Origami", "Kalita Wave", "Orea", "April", "Aeropress", "Prensa francesa", "Clever", "Espresso"
//   servings?: number,               // personas (filtro / inmersión). 1 persona ≈ 200 ml de agua
//   dose_g?: number,                 // gramos de café exactos (manda sobre servings; obligatorio en espresso)
//   equipment?: string,              // ej. "Comandante C40, V60 02 plástico"
//   preferences?: string,            // ej. "más dulce", "más brillante", "más cuerpo"
//   brew_method?: string             // compatibilidad con la versión anterior (se usa como dripper)
// }
// Respuesta: { ok: true, data: Recipe } | { ok: false, error: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { callStructured, corsHeaders, json } from "../_shared/ai.ts";

interface Recipe {
  title: string;
  brew_method: string;
  params: {
    dose_g: number;
    water_g: number | null;
    ratio: string;
    water_temp_c: number;
    grind: string;
    grind_reference: string | null;
    total_time: string;
    yield_g: number | null;
    pressure_bar: number | null;
  };
  steps: Array<{ time: string; action: string }>;
  rationale: string;
  adjustments: Array<{ if: string; then: string }>;
  rest_advice: string | null;
}

type Family = "conico" | "flat" | "inmersion" | "espresso";

const FAMILY_LABEL: Record<Family, string> = {
  conico: "Filtro cónico",
  flat: "Filtro de fondo plano",
  inmersion: "Inmersión",
  espresso: "Espresso",
};

const SYSTEM = `Eres un barista de especialidad con formación de campeonato y vocación de profesor. Diseñas recetas
de preparación para un amante del café que quiere entender por qué cada parámetro es como es.

Tu criterio se apoya en tres escuelas, resumidas en principios (no copies textos, aplica las ideas):
- La escuela de precisión y repetibilidad (estilo James Hoffmann): ratios en torno a 60 g de café por litro de agua
  (1:16 a 1:17), bloom con 2 a 3 veces el peso del café durante 45 s, vertidos pocos y controlados, un giro suave
  del cono para nivelar la cama, agua muy caliente (94-100 °C) para tuestes claros, y la molienda como la variable
  principal de ajuste. Para cantidades grandes, molienda más gruesa y menos vertidos.
- La escuela nórdica de limpieza y luminosidad (estilo Tim Wendelboe): tuestes claros, agua cerca del hervor,
  pocas intervenciones, ratios 1:16 a 1:17, buscar acidez brillante y taza limpia; evitar la sobreagitación.
- La escuela de dulzor y control de la agitación (estilo Diego Campos, campeón mundial 2021): temperaturas algo
  más bajas (88-93 °C) para naturales, honeys y fermentaciones anaeróbicas; bloom más largo en cafés muy
  procesados; agitación medida para subir dulzor sin astringencia; en espresso, ratios más largos para claridad.

Reglas por familia de método:
- Filtro cónico (V60, Origami, Chemex): molienda media-fina, 2 a 3 vertidos después del bloom, giro suave al
  final, tiempo total 2:45-3:30 para 1-2 personas (hasta ~400 g de agua). Más agua: molienda más gruesa y hasta 4:30.
- Filtro de fondo plano (Kalita Wave, Orea, April, Fellow Stagg): extracción más pareja y tolerante; molienda
  media (un punto más gruesa que en cónico), vertidos en pulsos regulares de 50-60 g, poco o nada de giro,
  tiempo total 3:00-3:45.
- Inmersión (Aeropress, prensa francesa, Clever, Switch): molienda media a media-gruesa, infusión 2:00-4:00 según
  el método, agitación mínima y controlada; en Aeropress indica si es método normal o invertido y la presión del
  émbolo lenta (20-30 s).
- Espresso: dosis 16-20 g, ratio 1:2 a 1:2.5 (hasta 1:3 para claridad en tuestes claros), 25-35 s, 9 bar;
  temperatura 92-95 °C (tuestes claros más alto). Indica dosis, salida en gramos y tiempo.

Reglas de cantidad:
- 1 persona = 200 ml (200 g) de agua. Si se indica la dosis de café, respétala y deriva el agua con el ratio elegido; si solo se indican personas, calcula el agua y deriva la dosis.
- Si se indican gramos de café, respétalos y calcula el agua con el ratio.
- Más de 400 g de agua en un filtro: molienda más gruesa, vertidos más grandes y tiempo total mayor; sugiere el tamaño
  de dripper adecuado (ej. V60 02 o 03) en grind_reference o en la justificación.

Reglas de salida:
- Español neutro, sin emojis. Tildes correctas (café, extracción, molienda, preinfusión).
- Concreto: gramos, temperatura, molienda, tiempos. Nada de rangos vagos salvo donde sea inevitable.
- Justifica la receta en 2-3 frases con el origen, el proceso y el tueste del café, y nombra la idea de escuela
  que aplicaste (por ejemplo "temperatura más baja para un honey, buscando dulzor").
- Si hay fecha de tueste, evalúa el reposo en rest_advice: filtro ideal 7-21 días, espresso 10-30 días; si el café
  está muy fresco o muy viejo, dilo y ajusta (molienda más fina si es viejo, temperatura algo más baja si es muy fresco).
- grind_reference: si el usuario indicó su molino, da el ajuste aproximado (clics, número) para ese molino; si no,
  describe la textura con una referencia cotidiana (sal de mesa, azúcar granulada, arena gruesa).
- "adjustments": exactamente 3, del tipo "si sabe X, haz Y", en orden de probabilidad.
- Pasos con marca de tiempo ("0:00", "0:45") y una acción breve cada uno. Entre 4 y 9 pasos. En espresso, los
  pasos cubren molienda, dosis, distribución, prensado y extracción con tiempos.
- title: corto y específico, incluye dripper, café y dosis (ej. "V60 para Catiope Honey, 15 g").
- brew_method: el nombre del dripper o método (ej. "V60", "Kalita Wave", "Aeropress", "Espresso").`;

const TOOL = {
  name: "entregar_receta",
  description: "Entrega la receta de preparación estructurada",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      brew_method: { type: "string" },
      params: {
        type: "object",
        properties: {
          dose_g: { type: "number" },
          water_g: { type: ["number", "null"] },
          ratio: { type: "string" },
          water_temp_c: { type: "number" },
          grind: { type: "string" },
          grind_reference: { type: ["string", "null"] },
          total_time: { type: "string" },
          yield_g: { type: ["number", "null"] },
          pressure_bar: { type: ["number", "null"] },
        },
        required: ["dose_g", "water_g", "ratio", "water_temp_c", "grind", "grind_reference", "total_time", "yield_g", "pressure_bar"],
      },
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: { time: { type: "string" }, action: { type: "string" } },
          required: ["time", "action"],
        },
      },
      rationale: { type: "string" },
      adjustments: {
        type: "array",
        items: {
          type: "object",
          properties: { if: { type: "string" }, then: { type: "string" } },
          required: ["if", "then"],
        },
      },
      rest_advice: { type: ["string", "null"] },
    },
    required: ["title", "brew_method", "params", "steps", "rationale", "adjustments", "rest_advice"],
  },
};

function inferFamily(dripper: string): Family {
  const d = dripper.toLowerCase();
  if (/espresso|moka/.test(d)) return "espresso";
  if (/aeropress|prensa|french|clever|switch|inmersi/.test(d)) return "inmersion";
  if (/kalita|orea|april|stagg|flat|plano/.test(d)) return "flat";
  return "conico";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Método no permitido" }, 405);
  }

  try {
    const body = await req.json();
    const coffee = body?.coffee && typeof body.coffee === "object" ? body.coffee : null;
    const coffeeDescription: string | null = typeof body?.coffee_description === "string" && body.coffee_description.trim() ? body.coffee_description.trim() : null;
    const dripper: string | undefined = body?.dripper ?? body?.brew_method;
    if (!dripper) {
      return json({ ok: false, error: "Falta dripper (o brew_method)" }, 400);
    }
    const family: Family = (["conico", "flat", "inmersion", "espresso"] as Family[]).includes(body?.method_family)
      ? body.method_family
      : inferFamily(dripper);
    const servings: number | null = Number.isFinite(body?.servings) && body.servings > 0 ? Math.min(8, Math.round(body.servings)) : null;
    const doseG: number | null = Number.isFinite(body?.dose_g) && body.dose_g > 0 ? Math.round(body.dose_g * 10) / 10 : null;


    const lines = [
      coffee ? `Café: ${coffee.name ?? "sin nombre"}` : coffeeDescription ? `Café (descrito por el usuario): ${coffeeDescription}` : `Café: no especificado (receta general para un café de especialidad de tueste claro-medio)`,
      coffee?.roaster_name ? `Tostador: ${coffee.roaster_name}` : null,
      coffee?.origin_country ? `Origen: ${coffee.origin_country}${coffee.region ? `, ${coffee.region}` : ""}` : null,
      coffee?.farm ? `Finca: ${coffee.farm}` : null,
      coffee?.variety ? `Variedad: ${coffee.variety}` : null,
      coffee?.process ? `Proceso: ${coffee.process}` : null,
      coffee?.altitude_masl ? `Altura: ${coffee.altitude_masl} msnm` : null,
      coffee?.roast_level ? `Nivel de tueste: ${coffee.roast_level}` : null,
      coffee?.roast_profile ? `Perfil de tueste: ${coffee.roast_profile}` : null,
      Array.isArray(coffee?.tasting_notes) && coffee.tasting_notes.length ? `Notas de cata: ${coffee.tasting_notes.join(", ")}` : null,
      coffee?.roast_date ? `Fecha de tueste: ${coffee.roast_date} (hoy es ${new Date().toISOString().slice(0, 10)})` : null,
      ``,
      `Familia de método: ${FAMILY_LABEL[family]}`,
      `Dripper / método: ${dripper}`,
      doseG
        ? `Dosis de café: ${doseG} g (respetar)${servings ? ` para ${servings} ${servings === 1 ? "persona" : "personas"}` : ""}`
        : servings
          ? `Cantidad: ${servings} ${servings === 1 ? "persona" : "personas"} (${servings * 200} g de agua aprox.)`
          : family === "espresso"
            ? `Dosis: elige la estándar (18 g)`
            : `Cantidad: 1 persona (200 g de agua)`,
      body.equipment ? `Equipo del usuario: ${body.equipment}` : null,
      body.preferences ? `Preferencia de taza: ${body.preferences}` : null,
    ].filter((l) => l !== null);

    const data = await callStructured<Recipe>({
      system: SYSTEM,
      content: [{ type: "text", text: lines.join("\n") }],
      tool: TOOL,
      maxTokens: 8192,
    });

    return json({ ok: true, data });
  } catch (err) {
    console.error("suggest-recipe error", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return json({ ok: false, error: message }, 500);
  }
});
