// Cliente mínimo para la API de Anthropic desde Deno (sin SDK).
// La key vive en el secret ANTHROPIC_API_KEY del proyecto Supabase.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";

type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    };

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Llama a Claude forzando el uso de una tool para obtener JSON estructurado.
 * Devuelve el `input` de la tool como objeto.
 */
export async function callClaudeTool<T>(opts: {
  system: string;
  content: ContentBlock[];
  tool: ToolDef;
  maxTokens?: number;
}): Promise<T> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("Falta el secret ANTHROPIC_API_KEY en el proyecto Supabase");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 1500,
      system: opts.system,
      tools: [opts.tool],
      tool_choice: { type: "tool", name: opts.tool.name },
      messages: [{ role: "user", content: opts.content }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text}`);
  }

  const data = await res.json();
  const toolUse = (data.content as Array<{ type: string; input?: unknown }>)
    .find((b) => b.type === "tool_use");
  if (!toolUse?.input) {
    throw new Error("Claude no devolvió un bloque tool_use");
  }
  return toolUse.input as T;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
