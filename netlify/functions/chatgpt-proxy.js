// netlify/functions/chatgpt-proxy.js
import OpenAI from "openai";
import referencias from "./referencias.json" assert { type: "json" };
import embeddings from "./mitiga_embeddings.json" assert { type: "json" };

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* -----------------------------------------------------------
   🔵 CONFIGURACIÓN BASE
----------------------------------------------------------- */
const MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-ada-002"; // estable y compatible

/* -----------------------------------------------------------
   🔵 ESTILO MITIGA (REGLAS DE RESPUESTA)
----------------------------------------------------------- */
const estiloMITIGA = `
ESTILO MITIGA — FORMATO DE RESPUESTA
------------------------------------

Cuando generes una respuesta, estructura SIEMPRE así:

1. <span style="color:#8A1538"><b>Título del punto en negrita y color MITIGA</b></span>: texto explicativo en la MISMA línea.

2. NO abras viñetas nuevas después del número.
   NO separes el título del contenido.
   NO cambies la numeración.

3. Usa Markdown permitido:
   - **negritas**
   - _cursivas_
   - saltos de línea

4. Está permitido usar HTML SOLO para aplicar color MITIGA (#8A1538):
   Ejemplo: <span style="color:#8A1538">texto</span>

5. No incluyas advertencias médicas genéricas.
6. No digas “como IA”, “como modelo”, ni nada técnico.
7. Responde siempre en tono calmado, práctico y orientado al domicilio.
`;

/* -----------------------------------------------------------
   🔵 6 CAPAS MITIGA (PROMPT DE SISTEMA)
----------------------------------------------------------- */
const capasMITIGA = `
CAPA 1 — INTERPRETACIÓN CLÍNICA (NO DIAGNÓSTICA)
Identifica qué puede estar ocurriendo desde la perspectiva del deterioro cognitivo y su impacto en la vida diaria.

CAPA 2 — RIESGOS ASOCIADOS
Determina qué riesgos podrían derivarse del síntoma descrito (caídas, desorientación, errores de medicación, agotamiento del cuidador…).

CAPA 3 — INTERVENCIÓN DOMICILIARIA INMEDIATA
Explica qué acciones concretas puede tomar hoy la familia para mitigar ese síntoma desde casa.

CAPA 4 — CUÁNDO ES SEÑAL DE ALERTA
Indica qué señales deben hacer que la familia consulte antes de lo previsto con su neurólogo.

CAPA 5 — OPTIMIZACIÓN DEL ENTORNO
Opciones para modificar iluminación, rutinas, comunicación, estímulos, etc.

CAPA 6 — RECOMENDACIONES PROFESIONALES MITIGA
Entrega recomendaciones prácticas derivadas del enfoque sociosanitario de MITIGA.
`;

/* -----------------------------------------------------------
   🔵 FUNCIONES RAG (BÚSQUEDA SEMÁNTICA LOCAL)
----------------------------------------------------------- */
function cosineSimilarity(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

async function buscarReferencias(query) {
  const emb = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
  });

  const vector = emb.data[0].embedding;

  const resultados = embeddings
    .map((r, idx) => ({
      idx,
      texto: referencias[idx].texto,
      sim: cosineSimilarity(vector, r.embedding),
    }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 3);

  return resultados.map(r => r.texto);
}

/* -----------------------------------------------------------
   🔵 HANDLER PRINCIPAL
----------------------------------------------------------- */
export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Método no permitido" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const userMessages = body.messages || [];

    if (userMessages.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No se recibieron mensajes" }),
      };
    }

    const ultimaPregunta = userMessages[userMessages.length - 1].content;

    // 🔍 Ejecutar RAG
    const docs = await buscarReferencias(ultimaPregunta);
    const contextoRAG = docs.join("\n---\n");

    // 🧠 Solicitud al modelo
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `
Eres MITIGA, asistente especializado en deterioro cognitivo y Alzheimer.
Usa SIEMPRE las 6 capas MITIGA.
Aplica SIEMPRE el Estilo MITIGA incluido abajo.

${estiloMITIGA}

${capasMITIGA}

Base de conocimiento relevante:
${contextoRAG}
        `,
        },
        ...userMessages,
      ],
      temperature: 0.15,
      max_tokens: 500,
    });

    const respuesta = completion.choices[0].message.content;

    return {
      statusCode: 200,
      body: JSON.stringify({ respuesta }),
    };
  } catch (err) {
    console.error("ERROR MITIGA PROXY:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error interno en MITIGA proxy",
        detalle: err.message,
      }),
    };
  }
}
