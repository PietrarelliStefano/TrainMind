// TrainMind: assistente AI per la versione online (funzione server di Vercel).
// La chiave Anthropic resta qui, sul server, nella variabile ANTHROPIC_API_KEY.
// Solo chi ha fatto l'accesso a TrainMind può usarla, con un limite di richieste al giorno.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // legge ANTHROPIC_API_KEY
const MODEL = "claude-opus-5-5";
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 80);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const JSON_SYSTEM =
  "Rispondi solo con un oggetto JSON valido, senza testo prima o dopo e senza blocchi di codice.";

function supa(path, token, init = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

function cleanMessages(list) {
  if (!Array.isArray(list)) return null;
  const out = list
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));
  return out.length && out[0].role === "user" ? out : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Usa POST" });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "Configurazione del server incompleta" });
    return;
  }

  // 1. Chi sta chiedendo: deve avere fatto l'accesso.
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ error: "Accesso richiesto" });
    return;
  }
  const who = await supa("/auth/v1/user", token);
  if (!who.ok) {
    res.status(401).json({ error: "Accesso scaduto: rientra" });
    return;
  }

  // 2. Limite giornaliero di richieste per allenatore.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const count = await supa(`/rest/v1/ai_usage?select=id&created_at=gte.${encodeURIComponent(since)}`, token, {
    headers: { Prefer: "count=exact", Range: "0-0" },
  });
  const used = Number((count.headers.get("content-range") || "*/0").split("/")[1]) || 0;
  if (used >= DAILY_LIMIT) {
    res.status(429).json({ error: `Hai usato le ${DAILY_LIMIT} richieste di oggi all'assistente` });
    return;
  }

  // 3. Richiesta: "json" (progettazione, esercizi) o "chat" (assistente).
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const tier = body.tier === "complex" ? "complex" : "default";
  let system;
  let messages;
  if (body.mode === "chat") {
    messages = cleanMessages(body.messages);
  } else {
    system = JSON_SYSTEM;
    messages = typeof body.prompt === "string" && body.prompt.trim() ? [{ role: "user", content: body.prompt }] : null;
  }
  if (!messages) {
    res.status(400).json({ error: "Richiesta vuota" });
    return;
  }

  await supa("/rest/v1/ai_usage", token, {
    method: "POST",
    headers: { "content-type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ tier }),
  });

  // 4. Risposta in streaming: il testo arriva man mano.
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    output_config: { effort: tier === "complex" ? "high" : "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    ...(system ? { system } : {}),
    messages,
  });
  res.on("close", () => {
    if (!res.writableEnded) stream.abort();
  });

  try {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        if (!res.headersSent) {
          res.statusCode = 200;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.setHeader("cache-control", "no-store");
        }
        res.write(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    if (!res.headersSent) {
      res.statusCode = 200;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    if (final.stop_reason === "refusal") res.write("\n[[TM_ERROR:refusal]]");
    else if (final.stop_reason === "max_tokens") res.write("\n[[TM_ERROR:max_tokens]]");
    res.end();
  } catch (error) {
    let code = "error";
    let status = 502;
    if (error instanceof Anthropic.RateLimitError) {
      code = "rate_limited";
      status = 429;
    } else if (error instanceof Anthropic.AuthenticationError) {
      code = "server_key";
      status = 500;
    } else if (error instanceof Anthropic.APIUserAbortError) {
      code = "aborted";
      status = 499;
    } else if (error instanceof Anthropic.APIError) {
      code = `api_${error.status}`;
    }
    if (!res.headersSent) res.status(status).json({ error: code });
    else {
      res.write(`\n[[TM_ERROR:${code}]]`);
      res.end();
    }
  }
}
