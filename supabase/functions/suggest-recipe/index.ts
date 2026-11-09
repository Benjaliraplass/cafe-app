// suggest-recipe: dado un café (origen, proceso, variedad, tueste, notas) y un método de
// preparación, devuelve una receta específica con parámetros y pasos, generada por IA (Gemini o Claude).
//
// Body: {
//   coffee: { name, roaster_name, origin_country, region, variety, process, altitude_masl,
//             roast_level, roast_profile, tasting_notes, roast_date },
//   brew_method: "V60" | "Aeropress" | "Espresso" | "Chemex" | "Prensa francesa" | "Moka" | "Kalita" | string,
//   equipment?: string,        // ej. "molino Comandante C40, balanza, hervidor con control de temperatura"
//   preferences?: string       // ej. "me gusta más dulce y con cuerpo"
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

const SYSTEM = `Eres un barista campeón y formador de café de especialidad. Diseñas recetas de preparación
adaptadas al café concreto que te describen: origen, proceso, variedad, altura, nivel y perfil de tueste,
notas de cata y fecha de tueste.

Reglas:
- Responde en español neutro. Sin emojis.
- Sé concreto: gramos, temperatura, molienda, tiempos. Nada de rangos vagos salvo donde sea inevitable.
- La receta debe estar justificada por las características del café (ej. un natural de Etiopía tostado claro
  pide más temperatura y molienda algo más fina para extraer acidez y florales; un Brasil de tueste medio
  para espresso pide un ratio más largo si se busca dulzor).
- Si hay fecha de tueste, considera el reposo (desgasificación) en rest_advice.
- En "adjustments" da 3 ajustes del tipo "si sabe X, haz Y".
- Si el método es Espresso: dose_g, yield_g, total_time, pressure_bar; water_g puede ser null.
- Si es un método de filtro o inmersión: dose_g, water_g, ratio, water_temp_c, grind, total_time; yield_g y pressure_bar null.
- grind_reference: si el usuario indicó su molino, da el clic/ajuste aproximado para ese molino; si no, null.
- Pasos con marca de tiempo (ej. "0:00", "0:45") y una acción breve por paso. Entre 4 y 9 pasos.`;

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
        required: [
          "dose_g",
          "water_g",
          "ratio",
          "water_temp_c",
          "grind",
          "grind_reference",
          "total_time",
          "yield_g",
          "pressure_bar",
        ],
      },
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            time: { type: "string" },
            action: { type: "string" },
          },
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
    required: [
      "title",
      "brew_method",
      "params",
      "steps",
      "rationale",
      "adjustments",
      "rest_advice",
    ],
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Método no permitido" }, 405);
  }

  try {
    const body = await req.json();
    const coffee = body?.coffee;
    const brew_method: string | undefined = body?.brew_method;

    if (!coffee || typeof coffee !== "object") {
      return json({ ok: false, error: "Falta coffee" }, 400);
    }
    if (!brew_method) {
      return json({ ok: false, error: "Falta brew_method" }, 400);
    }

    const lines = [
      `Café: ${coffee.name ?? "sin nombre"}`,
      coffee.roaster_name ? `Tostador: ${coffee.roaster_name}` : null,
      coffee.origin_country ? `Origen: ${coffee.origin_country}${coffee.region ? `, ${coffee.region}` : ""}` : null,
      coffee.farm ? `Finca: ${coffee.farm}` : null,
      coffee.variety ? `Variedad: ${coffee.variety}` : null,
      coffee.process ? `Proceso: ${coffee.process}` : null,
      coffee.altitude_masl ? `Altura: ${coffee.altitude_masl} msnm` : null,
      coffee.roast_level ? `Nivel de tueste: ${coffee.roast_level}` : null,
      coffee.roast_profile ? `Perfil de tueste: ${coffee.roast_profile}` : null,
      Array.isArray(coffee.tasting_notes) && coffee.tasting_notes.length
        ? `Notas de cata: ${coffee.tasting_notes.join(", ")}`
        : null,
      coffee.roast_date ? `Fecha de tueste: ${coffee.roast_date} (hoy es ${new Date().toISOString().slice(0, 10)})` : null,
      ``,
      `Método: ${brew_method}`,
      body.equipment ? `Equipo del usuario: ${body.equipment}` : null,
      body.preferences ? `Preferencias del usuario: ${body.preferences}` : null,
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
