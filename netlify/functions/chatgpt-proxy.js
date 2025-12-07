import OpenAI from "openai";
import referencias from "../../referencias.json";
import embeddingsData from "./mitiga_embeddings.json";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Método no permitido" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const messages = body.messages;

    if (!messages) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Faltan mensajes" }),
      };
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // -------------------------------------------------------------------
    // 🧠 1. CREAR EMBEDDING (modelo moderno compatible)
    // -------------------------------------------------------------------
    const embeddingResponse = await client.embeddings.create({
      model: "text-embedding-large",
      input: messages[messages.length - 1].content,
    });

    const userEmbedding = embeddingResponse.data[0].embedding;

    // -------------------------------------------------------------------
    // 🧠 2. CÁLCULO DE SIMILITUD PARA REFERENCIA MITIGA
    // -------------------------------------------------------------------
    let mejorCoincidencia = null;
    let mejorSimilitud = -Infinity;

    for (const item of embeddingsData) {
      const sim = coseno(userEmbedding, item.embedding);
      if (sim > mejorSimilitud) {
        mejorSimilitud = sim;
        mejorCoincidencia = item;
      }
    }

    let contexto = "";
    if (mejorCoincidencia && mejorCoincidencia.id) {
      contexto =
        referencias[mejorCoincidencia.id]?.texto ||
        referencias[mejorCoincidencia.id]?.frase ||
        "";
    }

    // -------------------------------------------------------------------
    // 🧠 3. 6 CAPAS MITIGA — SYSTEM PROMPT COMPLETO
    // -------------------------------------------------------------------
    const systemPrompt = `
Eres **MITIGA PRO**, asistente clínico–sociosanitario para Alzheimer y deterioro cognitivo.  
Tu misión es **anticipar y mitigar Eventos Médicos Evitables (EME)** en el entorno domiciliario.

Debes integrar SIEMPRE estas **6 capas**:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**1) Capa 1 — Pregunta actual del usuario**  
Comprende la situación real, su urgencia y contexto emocional.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**2) Capa 2 — Referencia MITIGA (búsqueda semántica)**  
Referencia encontrada:  
"${contexto}"

Utilízala solo si añade claridad, estructura o precisión.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**3) Capa 3 — MITIGA Base (tu identidad profesional)**  
- Lenguaje: claro, útil, no técnico, no paternalista.  
- Estilo: empático, humano, orientado a prevenir problemas reales.  
- Objetivo: ayudar a la familia a *actuar hoy* para evitar deterioro acelerado.  
- Evita alarmar salvo que sea clínicamente necesario.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**4) Capa 4 — Marco Clínico**  
Considera:  
- alteraciones de conducta  
- confusión nocturna  
- deterioro cognitivo fluctuante  
- causas clínicas de desorientación  
- signos de alarma que requieren neurólogo o urgencias  
- relación síntomas ↔ medicación / efectos adversos

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**5) Capa 5 — Marco Sociosanitario MITIGA**  
Incluye:  
- carga del cuidador  
- entorno físico inseguro  
- rutinas desestructuradas  
- adherencia a la medicación  
- factores de riesgo de EME (caídas, deshidratación, noches sin dormir…)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**6) Capa 6 — Entorno Familiar y Acción Práctica**  
Tus respuestas deben incluir recomendaciones concretas, realistas y aplicables hoy,  
no teoría.  
Incluye SIEMPRE pasos específicos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TU MISIÓN FINAL:
- Dar explicación del síntoma.  
- Identificar riesgos ocultos.  
- Proponer acciones preventivas.  
- Si procede, sugerir cuándo contactar con un profesional.

NO uses lenguaje de diagnóstico.  
NO sustituyes al neurólogo.  
Eres *la capa de inteligencia práctica en casa.*
`;

    // -------------------------------------------------------------------
    // 🧠 4. RESPUESTA FINAL DEL MODELO
    // -------------------------------------------------------------------
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        choices: [
          {
            message: completion.choices[0].message,
          },
        ],
      }),
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
};

// -------------------------------------------------------------------
// 📌 Función de similitud coseno
// -------------------------------------------------------------------
function coseno(a, b) {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
