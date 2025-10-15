import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const carpeta = "./referencias";
const salida = "./referencias/referencias.json";

async function generarEmbeddings() {
  const archivos = fs.readdirSync(carpeta).filter(f => f.endsWith(".txt"));
  const embeddings = [];

  for (const archivo of archivos) {
    const contenido = fs.readFileSync(path.join(carpeta, archivo), "utf8");
    console.log(`Procesando ${archivo}...`);

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: contenido.slice(0, 8000) // límite por archivo
    });

    embeddings.push({
      archivo,
      vector: response.data[0].embedding,
      texto: contenido.slice(0, 8000)
    });
  }

  fs.writeFileSync(salida, JSON.stringify(embeddings, null, 2));
  console.log(`✅ Embeddings guardados en ${salida}`);
}

generarEmbeddings();
