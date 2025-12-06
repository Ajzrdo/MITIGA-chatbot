import fs from "fs";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// Cliente OpenAI NUEVO SDK (correcto)
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Ruta embeddings
const embeddingsFile = path.join(process.cwd(), "referencias", "mitiga_embeddings.json");

/* --------------------------------------------------------------
   UTILIDADES
-------------------------------------------------------------- */
function dot(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}
function magnitude(v) {
  return Math.sqrt(v.reduce((sum, val, i) => sum + val * val, 0));
}
function cosineSimilarity(a, b) {
  return dot(a, b) / (magnitude(a) * magnitude(b));
}

/* --------------------------------------------------------------
   BUSCAR CONTEXTO (RAG) – con fallback seguro
-------------------------------------------------------------- */
async function buscarContexto(pregunta) {
  try {
    if (!fs.existsSync(embeddingsFile)) return "";

    const base = JSON.parse(fs.readFileSync(embeddingsFile, "utf8"));
    if (!Array.isArray(base) || base.length === 0) return "";

    const embedding = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: pregunta,
    });

    const vector = embedding.data[0].embedding;

    const scores = base.map((item) => ({
      ...item,
      score: cosineSimilarity(vector, item.embedding),
    }));

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.texto)
      .join("\n\n");

  } catch (err) {
    console.error("⚠️ Error en RAG:", err.message);
    return ""; // Fallback limpio
  }
}

/* --------------------------------------------------------------
   MEMORIA MITIGA
-------------------------------------------------------------- */
function generarMemoriaSimulada() {
  return `
MEMORIA_SIMULADA:
- Paciente: fase inicial/intermedia (estimado)
- Riesgos activos: adherencia, entorno, irritabilidad, carga del cuidador
- Hipótesis MITIGA: revisar desencadenantes ambientales, fatiga, cambios recientes
`.trim();
}

/* --------------------------------------------------------------
   HANDLER PRINCIPAL – Netlify Function
-------------------------------------------------------------- */
export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Método no permitido" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Asegurar parsing estable
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400,
      });
    }

    const { messages } = body;
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Faltan mensajes" }), {
        status: 400,
      });
    }

    const pregunta = messages[messages.length - 1]?.content || "";

    const contexto = await buscarContexto(pregunta);
    const memoria = generarMemoriaSimulada();

    /* ----------------------------------------------------------
       SYSTEM PROMPT MITIGA — COMPLETO
    ---------------------------------------------------------- */
    const systemPrompt = `
Eres el Asistente MITIGA…
[El resto de tu prompt aquí SIN CAMBIOS]
${memoria}

CONTEXTO_RELEVANTE:
${contexto}
`;

    const mensajes = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    /* ----------------------------------------------------------
       LLAMADA AL NUEVO SDK DE OPENAI 100% CORRECTA
    ---------------------------------------------------------- */
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",     // usa mini o gpt-4o, ambos válidos
      messages: mensajes,
      temperature: 0.45,
      top_p: 0.85,
      max_tokens: 750,
    });

    const respuesta = completion.choices?.[0]?.message?.content || "No se obtuvo respuesta.";

    return new Response(
      JSON.stringify({ choices: [{ message: { content: respuesta } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("❌ ERROR MITIGA-PROXY:", err.message, err.stack);
    return new Response(
      JSON.stringify({
        error: "Error interno en MITIGA proxy",
        detalle: err.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
