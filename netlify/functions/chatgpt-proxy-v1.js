import fs from "fs";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const embeddingsFile = path.join(process.cwd(), "referencias", "mitiga_embeddings.json");

/* Utilidades matemáticas */
function dot(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}
function magnitude(v) {
  return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
}
function cosineSimilarity(a, b) {
  return dot(a, b) / (magnitude(a) * magnitude(b));
}

/* Buscar contexto con RAG */
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

    const promptSistema = `
Eres MITIGA, asistente sociosanitario digital codesarrollado por Dekipling y el HULP/IdiPAZ.
Responde con estilo empático, breve y con claridad funcional.
(esta es la versión antigua v1)
Contexto:
${contexto}
`;

    const mensajes = [{ role: "system", content: promptSistema }, ...messages];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: mensajes,
      temperature: 0.6,
      top_p: 0.85,
    });

    return new Response(
      JSON.stringify({
        choices: [{ message: { content: completion.choices[0].message.content } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
