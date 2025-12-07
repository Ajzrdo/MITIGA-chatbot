// netlify/functions/chatgpt-proxy.js
import OpenAI from "openai";
import referencias from "./referencias.json" assert { type: "json" };
import embeddings from "./mitiga_embeddings.json" assert { type: "json" };

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let cachedEmbeddings = embeddings;

// -----------------------------------------------------------
// CONFIG
// -----------------------------------------------------------
const MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-ada-002";

// -----------------------------------------------------------
// FORMATO MITIGA – REFORZADO (NO SE PUEDE ROMPER)
// -----------------------------------------------------------

const formatoRigido = `
Debes responder SIEMPRE con el siguiente formato EXACTO.
NO puedes agregar saltos adicionales, NO puedes mover los títulos, NO puedes separar número/título/texto.

FORMATO OBLIGATORIO:

1. <span style="color:#8A1538"><b>Qué está ocurriendo</b></span>: [texto en una sola línea]
2. <span style="color:#8A1538"><b>Por qué importa</b></span>: [texto en una sola línea]
3. <span style="color:#8A1538"><b>Posibles EME</b></span>: [texto en una sola línea]
4. <span style="color:#8A1538"><b>Qué observar</b></span>: [texto en una sola línea]
5. <span style="color:#8A1538"><b>Qué hacer ahora</b></span>: [texto en una sola línea]
6. <span style="color:#8A1538"><b>Recomendación profesional MITIGA</b></span>: [texto en una sola línea]

REGLAS:
- NO generes viñetas internas.
- NO separes el número del título.
- NO insertes saltos después del número.
- TODO debe aparecer en una sola línea por punto.
- Usa solo negrita en el título.
- No uses advertencias tipo "consulta a un médico".
`;

// -----------------------------------------------------------
// BUSCAR REFERENCIAS (RAG)
// -----------------------------------------------------------

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

// -----------------------------------------------------------
// HANDLER PRINCIPAL
// -----------------------------------------------------------

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Método no permitido" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const messages = body.messages || [];
    if (messages.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "No messages" }) };
    }

    const ultimoMensaje = messages[messages.length - 1].content;

    // ------------------------------
    // RAG
    // ------------------------------
    const docs = await buscarReferencias(ultimoMensaje);
    const contexto = docs.join("\n---\n");

    // ------------------------------
    // Pregunta de clarificación
    // ------------------------------
    const preguntaClarificacion =
      "Antes de darte una recomendación más fina, ¿hay algo más que debamos saber sobre el contexto, el momento del día o el estado emocional previo de la persona?";

    // ------------------------------
    // Llamada al modelo
    // ------------------------------

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: 450,
      messages: [
        {
          role: "system",
          content: `
Eres MITIGA, asistente experto en deterioro cognitivo.
Tu misión: dar recomendaciones estructuradas, claras y accionables.

SIGUE ESTAS REGLAS CRÍTICAS:
${formatoRigido}

Contexto clínico relevante (RAG):
${contexto}

Recuerda siempre:
- Responder con formato MITIGA exacto.
- Ofrecer adicionalmente UNA pregunta de clarificación al final.
`
        },
        { role: "user", content: ultimoMensaje }
      ]
    });

    // ------------------------------
    // Añadir pregunta de clarificación
    // ------------------------------

    const respuestaFinal =
      completion.choices[0].message.content +
      `

<hr>

<span style="color:#8A1538"><b>PREGUNTA DE CLARIFICACIÓN MITIGA:</b></span> ${preguntaClarificacion}
`;

    return {
      statusCode: 200,
      body: JSON.stringify({ respuesta: respuestaFinal })
    };

  } catch (err) {
    console.error("MITIGA PROXY ERROR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error interno en MITIGA proxy", detalle: err.message })
    };
  }
}
