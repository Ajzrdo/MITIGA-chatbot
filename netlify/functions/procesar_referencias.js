/*
===============================================================================
MITIGA Chatbot – procesar_referencias.js
Genera un archivo local con embeddings de los textos MITIGA (sin Chroma)
===============================================================================
*/

import fs from "fs";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const referenciasPath = path.join(process.cwd(), "referencias");
const salidaPath = path.join(referenciasPath, "mitiga_embeddings.json");

async function generarEmbeddings() {
  console.log("🧠 Iniciando indexación de documentos MITIGA...");

  const archivos = fs
    .readdirSync(referenciasPath)
    .filter((f) => f.endsWith(".txt"));

  if (archivos.length === 0) {
    console.error("❌ No se encontraron archivos .txt en /referencias/");
    return;
  }

  const embeddingsTotales = [];

  for (const archivo of archivos) {
    const rutaArchivo = path.join(referenciasPath, archivo);
    const contenido = fs.readFileSync(rutaArchivo, "utf8");
    console.log(`📄 Procesando ${archivo}...`);

    const fragmentos = dividirTexto(contenido, 800);

    for (let i = 0; i < fragmentos.length; i++) {
      const fragmento = fragmentos[i];
      try {
        const emb = await openai.embeddings.create({
          model: "text-embedding-3-large",
          input: fragmento,
        });

        embeddingsTotales.push({
          id: `${archivo}_${i}`,
          origen: archivo,
          texto: fragmento,
          embedding: emb.data[0].embedding,
        });
      } catch (error) {
        console.error(`⚠️ Error procesando fragmento ${i} de ${archivo}:`, error.message);
      }
    }
  }

  fs.writeFileSync(salidaPath, JSON.stringify(embeddingsTotales, null, 2));
  console.log(`✅ Embeddings guardados en ${salidaPath}`);
}

function dividirTexto(texto, maxLongitud) {
  const parrafos = texto.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const fragmentos = [];
  let buffer = "";

  for (const p of parrafos) {
    if ((buffer + " " + p).length > maxLongitud) {
      fragmentos.push(buffer.trim());
      buffer = p;
    } else {
      buffer += " " + p;
    }
  }

  if (buffer.trim().length > 0) fragmentos.push(buffer.trim());
  return fragmentos;
}

generarEmbeddings()
  .then(() => console.log("🟣 MITIGA: Embeddings generados con éxito."))
  .catch((err) => console.error("❌ Error general:", err));
