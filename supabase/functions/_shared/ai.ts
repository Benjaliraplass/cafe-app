// Capa de IA para las Edge Functions. Soporta dos proveedores y devuelve JSON estructurado.
//
// Proveedor: env AI_PROVIDER = "gemini" | "anthropic". Si no está definido, se usa Gemini
// cuando existe GEMINI_API_KEY y Anthropic cuando existe ANTHROPIC_API_KEY.
//
// Secrets:
//   GEMINI_API_KEY     + opcional GEMINI_MODEL o GEMINI_MODELS (cadena de respaldo, ver DEFAULT_GEMINI_MODELS)
//   ANTHROPIC_API_KEY  + opcional ANTHROPIC_MODEL  (default "claude-sonnet-5-5")

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    };

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema (estilo Anthropic tool input_schema). Se convierte a schema de Gemini automáticamente. */
  input_schema: Record<string, unknown>;
}

export interface StructuredRequest {
  system: string;
  content: ContentBlock[];
  tool: ToolDef;
  maxTokens?: number;
}

type Provider = "gemini" | "anthropic";

function resolveProvider(): Provider {
  const forced = Deno.env.get("AI_PROVIDER")?.toLowerCase();
  if (forced === "gemini" || forced === "anthropic") return forced;
  if (Deno.env.get("GEMINI_API_KEY")) return "gemini";
  if (Deno.env.get("ANTHROPIC_API_KEY")) return "anthropic";
  throw new Error(
    "Falta configurar la IA: define el secret GEMINI_API_KEY o ANTHROPIC_API_KEY en el proyecto Supabase",
  );
}

/** Llama al proveedor configurado y devuelve el objeto JSON que cumple el schema de la tool. */
export async function callStructured<T>(opts: StructuredRequest): Promise<T> {
  const provider = resolveProvider();
  return provider === "gemini" ? callGemini<T>(opts) : callAnthropic<T>(opts);
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

// Cadena de modelos: si el primero devuelve 429/503 (saturación), se prueba el siguiente.
// Se puede sobreescribir con GEMINI_MODEL (uno) o GEMINI_MODELS (lista separada por comas).
const DEFAULT_GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
];

function geminiModels(): string[] {
  const list = Deno.env.get("GEMINI_MODELS");
  if (list) return list.split(",").map((s) => s.trim()).filter(Boolean);
  const single = Deno.env.get("GEMINI_MODEL");
  if (single) return [single, ...DEFAULT_GEMINI_MODELS.filter((m) => m !== single)];
  return DEFAULT_GEMINI_MODELS;
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
// Timeout por llamada: si Gemini se cuelga bajo demanda alta, pasamos al siguiente modelo.
const PER_CALL_TIMEOUT_MS = 20_000;
// Presupuesto total: las Edge Functions tienen límite de wall-clock (~150 s); dejamos margen.
const TOTAL_BUDGET_MS = 90_000;

async function callGemini<T>(opts: StructuredRequest): Promise<T> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("Falta el secret GEMINI_API_KEY");

  const started = Date.now();
  const errors: string[] = [];
  for (const model of geminiModels()) {
    // Hasta 2 intentos por modelo ante saturación, con pausa corta
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() - started > TOTAL_BUDGET_MS) break;
      try {
        return await callGeminiModel<T>(opts, apiKey, model);
      } catch (err) {
        const e = err as Error & { status?: number };
        errors.push(`${model}: ${e.message.slice(0, 160)}`);
        if (e.status === 404) break; // modelo inexistente para esta key: pasar al siguiente sin reintentar
        if (!e.status || !RETRYABLE.has(e.status)) throw err; // error no recuperable (400, 403, JSON inválido...)
        if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
      }
    }
  }
  throw new Error(`Gemini no disponible en este momento. Intentos: ${errors.join(" | ")}`);
}

async function callGeminiModel<T>(opts: StructuredRequest, apiKey: string, model: string): Promise<T> {
  const parts = opts.content.map((b) =>
    b.type === "text"
      ? { text: b.text }
      : { inline_data: { mime_type: b.source.media_type, data: b.source.data } },
  );

  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: Math.max(opts.maxTokens ?? 1500, 4096),
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(opts.tool.input_schema),
    },
  };

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(PER_CALL_TIMEOUT_MS),
      },
    );
  } catch (e) {
    const isTimeout = e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");
    const err = new Error(isTimeout ? `Gemini timeout (${PER_CALL_TIMEOUT_MS / 1000}s)` : `Gemini fetch: ${String(e)}`) as Error & { status?: number };
    err.status = 408; // tratado como reintentable
    throw err;
  }

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Gemini API ${res.status}: ${text.slice(0, 600)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const finishReason: string = candidate?.finishReason ?? data?.promptFeedback?.blockReason ?? "sin contenido";
  const text: string | undefined = candidate?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) {
    const err = new Error(`Gemini no devolvió JSON (${finishReason})`) as Error & { status?: number };
    err.status = 502; // reintentable con el siguiente modelo
    throw err;
  }
  try {
    return JSON.parse(stripFences(text)) as T;
  } catch {
    console.error(`Gemini JSON inválido [${model}] finishReason=${finishReason} len=${text.length} tail=${JSON.stringify(text.slice(-200))}`);
    const err = new Error(
      finishReason === "MAX_TOKENS"
        ? `Gemini devolvió una respuesta truncada (${model})`
        : `Gemini devolvió un JSON inválido (${model})`,
    ) as Error & { status?: number };
    err.status = 502; // reintentable con el siguiente modelo
    throw err;
  }
}

/** Quita ```json ... ``` si el modelo lo agregó pese al responseMimeType. */
function stripFences(s: string): string {
  const t = s.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return t;
}

/**
 * Convierte un JSON Schema sencillo (type arrays con null, enum con null, additionalProperties)
 * al subconjunto OpenAPI que acepta Gemini (type en mayúsculas, nullable, sin null en enum).
 */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;

  const src = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  // type
  let nullable = false;
  let type = src.type;
  if (Array.isArray(type)) {
    const nonNull = (type as string[]).filter((t) => t !== "null");
    nullable = nonNull.length !== (type as string[]).length;
    type = nonNull[0] ?? "string";
  }
  if (typeof type === "string") out.type = type.toUpperCase();
  if (nullable) out.nullable = true;

  if (typeof src.description === "string") out.description = src.description;

  if (Array.isArray(src.enum)) {
    const values = (src.enum as unknown[]).filter((v) => v !== null).map(String);
    out.enum = values;
    if ((src.enum as unknown[]).includes(null)) out.nullable = true;
    // enum solo es válido para STRING en Gemini
    out.type = "STRING";
  }

  if (src.properties && typeof src.properties === "object") {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src.properties as Record<string, unknown>)) {
      props[k] = toGeminiSchema(v);
    }
    out.properties = props;
  }
  if (Array.isArray(src.required)) out.required = src.required;
  if (src.items) out.items = toGeminiSchema(src.items);

  return out;
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

async function callAnthropic<T>(opts: StructuredRequest): Promise<T> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Falta el secret ANTHROPIC_API_KEY");
  const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 1500,
      system: opts.system,
      tools: [opts.tool],
      tool_choice: { type: "tool", name: opts.tool.name },
      messages: [{ role: "user", content: opts.content }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 600)}`);
  }

  const data = await res.json();
  const toolUse = (data.content as Array<{ type: string; input?: unknown }>)
    .find((b) => b.type === "tool_use");
  if (!toolUse?.input) throw new Error("Claude no devolvió un bloque tool_use");
  return toolUse.input as T;
}

// ---------------------------------------------------------------------------

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
