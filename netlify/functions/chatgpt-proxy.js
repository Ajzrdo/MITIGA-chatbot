// netlify/functions/chatgpt-proxy.js
import OpenAI from "openai";
import referencias from "./referencias.json" assert { type: "json" };
import embeddings from "./mitiga_embeddings.json" assert { type: "json" };

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ⚡ Cache en memoria dentro del runtime Netlify
let cachedEmbeddings = embeddings;

// ------------------------ CONFIG -----------------------------

const MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-ada-002";

// ----------------------- ESTILO MITIGA ------------------------

const estiloMITIGA = `
FORMATO OBLIGATORIO — NO ROMPER NUNCA:

Cada respuesta debe seguir EXACTAMENTE este formato:

1. <span style="color:#8A1538"><b>Qué está ocurriendo</b></span>: texto en la MISMA línea, sin saltos, sin viñetas adicionales.
2. <span style="color:#8A1538"><b>Por qué importa</b></span>: texto en la misma línea.
3. <span style="color:#8A1538"><b>Posibles EME</b></span>: texto en la misma línea.
4. <span style="color:#8A1538"><b>Qué observar</b></span>: texto en la misma línea.
5. <span style="color:#8A1538"><b>Qué hacer ahora</b></span>: texto en la misma línea.
6. <span style="color:#8A1538"><b>Recomendación profesional MITIGA</b></span>: texto en la misma línea.

Reglas críticas:
- Prohibido generar viñetas debajo de cada número.
- Prohibido separar título y contenido.
- Prohibido insertar saltos entre número → título → contenido.
- Siempre usar el color #8A1538 y negrita solo en el título.
- No usar “como IA”, “según la evidencia”, ni advertencias médicas.
`;

// --------------------- FUNCIONES RAG --------------------------

function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

async function buscarReferencias(query) {
  const emb = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query
  });

  const vec = emb.data[0].embedding;

  return cachedEmbeddings
    .map((e, i) => ({
      texto: referencias[i].texto,
      score: cosine(vec, e.embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(r => r.texto);
}

// ----------------------- HANDLER -----------------------------

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Método no permitido" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const messages = body.messages || [];
    if (messages.length === 0)
      return { statusCode: 400, body: JSON.stringify({ error: "No messages" }) };

    const ultimo = messages[messages.length - 1].content;

    // RAG
    const docs = await buscarReferencias(ultimo);
    const contexto = docs.join("\n---\n");

    // Plantilla rígida que el modelo debe completar EXACTAMENTE.
    const plantillaSalida = `
RESPONDE COMPLETANDO EXACTAMENTE ESTA PLANTILLA:

1. <span style="color:#8A1538"><b>Qué está ocurriendo</b></span>: 
2. <span style="color:#8A1538"><b>Por qué importa</b></span>: 
3. <span style="color:#8A1538"><b>Posibles EME</b></span>: 
4. <span style="color:#8A1538"><b>Qué observar</b></span>: 
5. <span style="color:#8A1538"><b>Qué hacer ahora</b></span>: 
6. <span style="color:#8A1538"><b>Recomendación profesional MITIGA</b></span>: 
`;

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      top_p: 0.7,
      max_tokens: 450,
      messages: [
        {
          role: "system",
          content: `
Eres MITIGA, asistente experto en deterioro cognitivo.
Usa siempre el formato obligatorio MITIGA.
${estiloMITIGA}

Contexto relevante (RAG):
${contexto}

Debes cumplir la plantilla final sin romper el formato.
          `
        },
        { role: "user", content: ultimo },
        { role: "assistant", content: plantillaSalida }
      ]
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ respuesta: completion.choices[0].message.content })
    };

  } catch (err) {
    console.error("MITIGA PROXY ERROR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error interno en MITIGA proxy", detalle: err.message })
    };
  }
}
