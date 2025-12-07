// netlify/functions/chatgpt-proxy.js
import OpenAI from "openai";
import referencias from "./referencias.json" assert { type: "json" };
import embeddings from "./mitiga_embeddings.json" assert { type: "json" };

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-ada-002";

let cachedEmbeddings = embeddings;

// -----------------------------------------------------------
// UTILIDAD: SIMILITUD COSENO
// -----------------------------------------------------------
function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// -----------------------------------------------------------
// BUSCAR REFERENCIAS (RAG)
// -----------------------------------------------------------
async function buscarReferencias(query) {
  const emb = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query
  });

  const vec = emb.data[0].embedding;

  return cachedEmbeddings
    .map((e, i) => ({ texto: referencias[i].texto, score: cosine(vec, e.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(r => r.texto);
}

// -----------------------------------------------------------
// FORMATO RÍGIDO MITIGA (NO ROMPIBLE)
// -----------------------------------------------------------
const formatoRigido = `
Debes responder SIEMPRE con este formato exacto en HTML:

1. <span style="color:#8A1538"><b>Qué está ocurriendo</b></span>: [una sola línea]
2. <span style="color:#8A1538"><b>Por qué importa</b></span>: [una sola línea]
3. <span style="color:#8A1538"><b>Posibles EME</b></span>: [una sola línea]
4. <span style="color:#8A1538"><b>Qué observar</b></span>: [una sola línea]
5. <span style="color:#8A1538"><b>Qué hacer ahora</b></span>: [una sola línea]
6. <span style="color:#8A1538"><b>Recomendación profesional MITIGA</b></span>: [una sola línea]

REGLAS:
- NO separes el número del título.
- NO pongas saltos adicionales.
- NO uses viñetas internas.
- Cada punto es UNA sola línea.
- Mantén el estilo HTML EXACTO.
`;

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
    // PRIMERA INTERACCIÓN → HACER PREGUNTAS
    // ------------------------------
    if (messages.length === 1) {
      const preguntas = `
Gracias por compartir esta situación. Para darte una orientación precisa necesito dos aclaraciones rápidas:

1. <b>¿Hace cuánto ocurre esto?</b> (por ejemplo, días, semanas, meses)
2. <b>¿Qué suele pasar justo antes del episodio?</b> (ruidos, discusiones, despertares nocturnos, confusión, cambios en la medicación)

Con estas dos respuestas podré darte un análisis completo en formato MITIGA.
`;

      return {
        statusCode: 200,
        body: JSON.stringify({ respuesta: preguntas })
      };
    }

    // ------------------------------
    // RAG PARA INTERACCIONES POSTERIORES
    // ------------------------------
    const docs = await buscarReferencias(ultimoMensaje);
    const contexto = docs.join("\n---\n");

    // ------------------------------
    // CONSTRUCCIÓN RESPUESTA MITIGA
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

Tu misión:
- sintetizar,
- priorizar,
- orientar,
- sin alarmismos,
- sin mensajes genéricos,
- con precisión clínica y enfoque práctico.

Debes responder ahora en formato MITIGA siguiendo estas reglas estrictas:
${formatoRigido}

Contexto adicional desde documentos relevantes:
${contexto}
          `
        },
        ...messages
      ]
    });

    const respuesta = completion.choices[0].message.content;

    return {
      statusCode: 200,
      body: JSON.stringify({ respuesta })
    };

  } catch (err) {
    console.error("MITIGA PROXY ERROR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error interno en MITIGA proxy", detalle: err.message })
    };
  }
}
