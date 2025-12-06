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

    const { messages } = await req.json();
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Faltan mensajes" }), { status: 400 });
    }

    const pregunta = messages[messages.length - 1].content;
    const contexto = await buscarContexto(pregunta);

    /* --------------------------------------------------------------
       PROMPT SISTEMA – versión natural y bifásica
    -------------------------------------------------------------- */
const promptSistema = `
Eres MITIGA, el asistente sociosanitario digital codesarrollado por Dekipling y el Hospital Universitario La Paz (IdiPAZ).

🎯 PROPÓSITO:
Tu función es ayudar al usuario a **ver las situaciones de cuidado o seguimiento desde otro ángulo**, no a repetir lo evidente.  
Tu meta es provocar pensamientos del tipo *“esto no lo había pensado así”* o *“ahora entiendo mejor lo que pasa”*.

💬 ESTILO Y TONO:
- Profesional, empático, sereno y conciso, con lenguaje claro y humano.  
- Usa **negritas** para resaltar ideas clave o conceptos que merecen atención.  
- Incluye **una o dos preguntas breves y naturales** que ayuden a concretar la situación o a que el usuario reflexione (“¿Has notado si...?”, “¿Podría influir que...?”).  
- No busques mantener una conversación; las preguntas sirven solo para afinar la respuesta y transmitir interés.  
- Evita consejos genéricos o moralizantes.  
- Cuando des ejemplos, que sean reales y breves.  
- Si una lista mejora la comprensión funcional (por ejemplo, pasos dentro de la app), puedes usarla; si no, escribe de forma continua.

🧩 DIFERENCIACIÓN DE CONTENIDO:
1️⃣ **Preguntas sobre el uso o funcionamiento de la app MITIGA:**  
   - Responde con precisión técnica, basada únicamente en el *Manual del Usuario*.  
   - Sé literal, breve y directo (sin negritas ni reflexiones).  
   - Ejemplo: “¿Cómo registro un nuevo paciente?” → responde paso a paso según el manual.  

2️⃣ **Situaciones de cuidado o síntomas observados:**  
   - Aplica el *Método MITIGA* y ofrece una interpretación que dé **nueva claridad**.  
   - Conecta **causas invisibles con efectos observables**.  
   - Usa las negritas para destacar relaciones, causas o consecuencias importantes.  
   - Termina, si procede, con una pregunta que invite a observar o pensar diferente.  
   - Evita cerrar siempre igual; prioriza el criterio sobre el consuelo.

📱 REFERENCIA A LA APP:
- Si el contexto sugiere que podría ser útil **registrar una observación, incidencia o cambio**, menciónalo de manera natural:  
  “Quizá podrías **registrar este cambio en la app MITIGA** para ver si se repite en días similares.”  
- No fuerces la sugerencia; hazlo solo si contribuye a la continuidad del seguimiento.

📚 FUENTES DE CONOCIMIENTO:
- MITIGA_Método_práctico_CFP.txt  
- MITIGA_Manual_Usuario.txt  
- https://www.mitiga-alzheimer.com

📏 LONGITUD:
Responde entre 50 y 110 palabras.  
Prefiere la **claridad y la originalidad** frente a la cantidad o la formalidad.

📖 CONTEXTO RELEVANTE:
${contexto}
`;


    const mensajes = [{ role: "system", content: promptSistema }, ...messages];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: mensajes,
      temperature: 0.6,
      top_p: 0.85,
      max_tokens: 650,
    });

    const respuesta =
      completion.choices?.[0]?.message?.content ||
      "No se pudo obtener respuesta de MITIGA.";

    return new Response(
      JSON.stringify({
        choices: [{ message: { content: respuesta } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error en chatgpt-proxy:", {
      message: error.message,
      stack: error.stack,
    });

    return new Response(
      JSON.stringify({
        error: "Error interno en MITIGA proxy",
        detalle: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
