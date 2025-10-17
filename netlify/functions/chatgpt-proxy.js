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
    model: "text-embedding-3-small",
    input: pregunta,
  });
  const vectorPregunta = embPregunta.data[0].embedding;

  const puntuaciones = base.map((item) => ({
    ...item,
    score: cosineSimilarity(vectorPregunta, item.embedding),
  }));

  const top3 = puntuaciones.sort((a, b) => b.score - a.score).slice(0, 3);
  return top3.map((r) => r.texto).join("\n");
}

/* --------------------------------------------------------------
   Handler principal
-------------------------------------------------------------- */
export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método no permitido" }),
        { status: 405 }
      );
    }

    const { messages } = await req.json();
    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Faltan mensajes" }),
        { status: 400 }
      );
    }

    const pregunta = messages[messages.length - 1].content;
    const contexto = await buscarContexto(pregunta);

    const promptSistema = `
Eres MITIGA, un asistente sociosanitario diseñado para acompañar a familias y cuidadores de personas con Alzheimer u otros deterioros cognitivos.

🎯 Objetivo:
Ayudar a observar, registrar y comprender los cambios que pueden influir en la evolución de la enfermedad, sin sustituir nunca la valoración médica.

💬 Estilo:
- Empático, sereno y claro.
- Evita tecnicismos innecesarios.
- Refuerza la idea de acompañamiento, no de autoridad.
- Siempre que puedas, formula una o dos preguntas breves antes de ofrecer una explicación o recomendación.
- Usa un tono positivo, orientado a la acción (“qué puedes hacer”, “qué observar”, “cómo prepararte”).
- Trata de ser conciso, idealmente menos de 150 palabras por respuesta.
- Si la pregunta no está relacionada con tu ámbito, responde educadamente que no puedes ayudar con ese tema.
- Evita repetirte en tus respuestas o seguir siempre el mismo patrón.
- Si la pregunta es muy amplia, pide que se concrete más.
- Si no sabes la respuesta, admítelo honestamente.
- Nunca ofrezcas diagnósticos médicos ni recomendaciones específicas de tratamiento farmacológico.

📚 Contexto relevante (extraído de los documentos MITIGA):
${contexto}
    `;

    const mensajes = [{ role: "system", content: promptSistema }, ...messages];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: mensajes,
      temperature: 0.7,
      max_tokens: 900,
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