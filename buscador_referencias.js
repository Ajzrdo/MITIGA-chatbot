import fs from "fs";
import OpenAI from "openai";
import cosineSimilarity from "cosine-similarity";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const data = JSON.parse(fs.readFileSync("./referencias/referencias.json", "utf8"));

export async function buscarFragmentosRelevantes(pregunta, maxResultados = 3) {
  const embPregunta = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: pregunta
  });

  const vectorPregunta = embPregunta.data[0].embedding;

  const puntuaciones = data.map((item) => ({
    ...item,
    similitud: cosineSimilarity(vectorPregunta, item.vector)
  }));

  const relevantes = puntuaciones
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, maxResultados)
    .map(r => r.texto.trim());

  return relevantes.join("\n---\n");
}
