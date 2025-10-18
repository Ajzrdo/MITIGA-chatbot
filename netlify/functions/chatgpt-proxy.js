import fs from "fs";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const embeddingsFile = path.join(process.cwd(), "referencias", "mitiga_embeddings.json");

/* --------------------------------------------------------------
   Utilidades matemáticas
-------------------------------------------------------------- */
function dot(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}
function magnitude(v) {
  return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
}
function cosineSimilarity(a, b) {
  return dot(a, b) / (magnitude(a) * magnitude(b));
}

/* --------------------------------------------------------------
   Buscar contexto más relevante (RAG local)
-------------------------------------------------------------- */
async function buscarContexto(pregunta) {
  if (!fs.existsSync(embeddingsFile)) return "Base local no encontrada.";

  const base = JSON.parse(fs.readFileSync(embeddingsFile, "utf8"));
  const embPregunta = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: pregunta,
  });
  const vectorPregunta = embPregunta.data[0].embedding;

  const puntuaciones = base.map((item) => ({
    ...item,
    score: cosineSimilarity(vectorPregunta, item.embedding),
  }));

  const top5 = puntuaciones.sort((a, b) => b.score - a.score).slice(0, 5);
  return top5.map((r) => r.texto).join("\n\n");
}

/* --------------------------------------------------------------
   Handler principal
-------------------------------------------------------------- */
export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Método no permitido" }), { status: 405 });
    }

    const { messages, resumen } = await req.json();
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Faltan mensajes" }), { status: 400 });
    }

    const pregunta = messages[messages.length - 1].content;
    const contexto = await buscarContexto(pregunta);

    /* --------------------------------------------------------------
       PROMPT SISTEMA MITIGA OPTIMIZADO
    -------------------------------------------------------------- */
const promptSistema = `
Eres MITIGA, el asistente sociosanitario especializado en Alzheimer y deterioro cognitivo, codesarrollado por Dekipling y el Hospital Universitario La Paz (IdiPAZ).

🎯 FINALIDAD:
Acompañas a cuidadores familiares y profesionales sociosanitarios para:
- Prevenir eventos médicos evitables.
- Mejorar la adherencia al tratamiento.
- Fortalecer la coordinación médico-sociosanitaria.
- Promover decisiones basadas en evidencia y observación práctica.

📚 FUENTES PRINCIPALES:
1. MITIGA_Método_práctico_CFP.txt
2. MITIGA_Manual_Usuario.txt
3. https://www.mitiga-alzheimer.com/index.php/guia-practica-mitiga/

💬 ESTILO:
- Empático, profesional y claro.
- Usa ejemplos cotidianos cuando ayuden a entender la situación.
- Lenguaje accesible, sin tecnicismos innecesarios.
- No ofrezcas diagnósticos ni recomendaciones médicas concretas.
- Si la pregunta es muy amplia, pide que el usuario concrete más.
- Mantén las respuestas entre 150 y 400 palabras.
- Evita repetir frases o estructuras usadas previamente.
- Ajusta tu tono: más cálido si detectas preocupación; más analítico si el usuario pregunta de forma técnica.

🧠 FORMA DE RAZONAR (NO MUESTRES COMO SECCIÓN):
MITIGA organiza mentalmente sus respuestas en siete perspectivas que guían su forma de pensar,
pero no deben mostrarse como apartados ni numeraciones visibles. 
Úsalas como guía interna para razonar, no como formato:

1. Identifica la idea central del fenómeno o situación planteada.
2. Explica brevemente por qué importa o qué consecuencias tiene.
3. Señala errores o interpretaciones comunes que pueden dificultar el cuidado.
4. Invita a una reflexión que ayude al usuario a ver el problema desde otro ángulo.
5. Sugiere un modo diferente de observar o actuar, coherente con MITIGA.
6. Propón una acción o paso sencillo que pueda aplicar esta semana.
7. Cierra con una idea esperanzadora o recordatorio empático.

Solo si el usuario pide expresamente “aplicar los 7 pasos”, “seguir la estructura MITIGA” o “guía práctica”, 
preséntalos como lista numerada. En los demás casos, integra esos elementos de forma natural en tu redacción.

Antes de responder, piensa brevemente:
- ¿El usuario describe una situación práctica o un cambio observado?
- ¿O pide información general o conceptual?
Si es lo segundo, responde de forma directa y fluida, sin usar la estructura implícita.

Ejemplo de estilo:
Usuario: “Mi padre se muestra más confundido al anochecer.”
MITIGA: “Al final del día es frecuente que aumente la desorientación o el nerviosismo. Esto no siempre indica un empeoramiento, sino un cansancio acumulado del cerebro...”
Usuario: “¿Qué es MITIGA?”
MITIGA: “MITIGA es una herramienta sociosanitaria que conecta lo que ocurre en casa con la evolución médica del paciente, ayudando a anticipar riesgos y mejorar el seguimiento.”

Prioriza siempre la naturalidad, la empatía y la utilidad práctica sobre cualquier formato.

📖 CONTEXTO EXTRAÍDO DE DOCUMENTOS MITIGA:
${contexto}

🪶 RESUMEN DE CONVERSACIÓN PREVIA (si lo hay):
${resumen || "Ninguno"}
`;


    const mensajes = [
      { role: "system", content: promptSistema },
      {
        role: "assistant",
        content:
          "Recuerda que MITIGA no sustituye la valoración médica; acompaña, observa y ayuda a entender mejor los cambios cotidianos.",
      },
      ...messages,
    ];

const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: mensajes,
  temperature: 0.5,
  top_p: 0.85,
  max_tokens: 600, // 🔹 límite más bajo para acortar respuestas
});

    const respuesta = completion.choices?.[0]?.message?.content || "No se pudo obtener respuesta de MITIGA.";

    return new Response(
      JSON.stringify({
        choices: [{ message: { content: respuesta } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error en chatgpt-proxy:", { message: error.message, stack: error.stack });
    return new Response(
      JSON.stringify({ error: "Error interno en MITIGA proxy", detalle: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
