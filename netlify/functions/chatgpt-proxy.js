// netlify/functions/chatgpt-proxy.js

import OpenAI from "openai";
import fs from "fs";
import path from "path";

// -------------------------------------------------------------
// CONFIG
// -------------------------------------------------------------
const EMBEDDINGS_PATH = "./netlify/functions/mitiga_embeddings.json";
let EMBEDDINGS = [];

// Cargar embeddings precomputados
try {
  const raw = fs.readFileSync(EMBEDDINGS_PATH, "utf8");
  EMBEDDINGS = JSON.parse(raw);
  console.log("Embeddings cargados:", EMBEDDINGS.length);
} catch (e) {
  console.warn("No se pudo cargar mitiga_embeddings.json");
  EMBEDDINGS = [];
}

// Función distancia coseno (para comparar embeddings)
function cosineSimilarity(a, b) {
  let dot = 0.0;
  let na = 0.0;
  let nb = 0.0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// -------------------------------------------------------------
// RAG — obtener contexto usando ADA-002
// -------------------------------------------------------------
async function obtenerContexto(client, pregunta) {
  if (!EMBEDDINGS.length) return "";

  // 1. Generar embedding de la pregunta usando ADA-002
  const embeddingUser = await client.embeddings.create({
    model: "text-embedding-ada-002",
    input: pregunta
  });

  const vectorUser =
    embeddingUser.data?.[0]?.embedding || embeddingUser.data?.[0] || [];

  if (!vectorUser.length) return "";

  // 2. Buscar los 3 fragmentos más similares
  const scored = EMBEDDINGS.map((item) => ({
    texto: item.texto,
    score: cosineSimilarity(vectorUser, item.vector)
  }));

  scored.sort((a, b) => b.score - a.score);

  // Tomar máximo 3
  const top = scored.slice(0, 3).map((x) => x.texto).join("\n\n");

  return top;
}

// -------------------------------------------------------------
// MITIGA PRO — 6 CAPAS
// -------------------------------------------------------------
function construirPromptMITIGA(pregunta, contexto) {
  return `
Eres el Asistente MITIGA, especializado en deterioro cognitivo y Alzheimer.

────────────────────────────────────────
CAPA 1 — ROL MITIGA
────────────────────────────────────────
Ayudas a familias y cuidadores con orientación práctica, basada en evidencia
divulgativa. NO diagnosticas ni prescribes.

────────────────────────────────────────
CAPA 2 — BLENDING CLÍNICO
────────────────────────────────────────
Integra: el manual MITIGA, el contexto clínico, el problema del usuario
y las buenas prácticas sociosanitarias.

────────────────────────────────────────
CAPA 3 — CONTEXT SCAFFOLDING
────────────────────────────────────────
Paciente tipo: deterioro leve–moderado, entorno domiciliario, riesgos comunes:
adherencia, sueño, irritabilidad, desorientación nocturna.

────────────────────────────────────────
CAPA 4 — META-RAZONAMIENTO
────────────────────────────────────────
Antes de responder analiza: causas posibles, riesgos, factores modificables,
acciones inmediatas y señales de alerta.

────────────────────────────────────────
CAPA 5 — MEMORIA SIMULADA
────────────────────────────────────────
Simula experiencia acumulada MITIGA sin almacenar datos del usuario.

────────────────────────────────────────
CAPA 6 — GUARDAILS
────────────────────────────────────────
Tono: empático, claro, no alarmista.  
Estructura sugerida:
1) Comprensión  
2) Posibles causas  
3) Acciones prácticas hoy  
4) Qué observar  
5) Cuándo consultar  

────────────────────────────────────────
PREGUNTA DEL USUARIO:
"${pregunta}"

────────────────────────────────────────
FRAGMENTOS RELEVANTES MITIGA (RAG):
${contexto}
  `.trim();
}

// -------------------------------------------------------------
// HANDLER —— FUNCIÓN SERVERLESS NETLIFY
// -------------------------------------------------------------
export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Método no permitido" };
    }

    const payload = JSON.parse(event.body || "{}");

    const mensajes = payload.messages || [];
    const pregunta = mensajes[mensajes.length - 1]?.content || "";

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 💡 Producir contexto usando ADA-002
    const contexto = await obtenerContexto(client, pregunta);

    const promptFinal = construirPromptMITIGA(pregunta, contexto);

    // Llamada correcta al nuevo SDK (Responses API)
    const respuesta = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: promptFinal },
        ...mensajes.map((m) => ({ role: m.role, content: m.content }))
      ],
      max_output_tokens: 600,
      temperature: 0.55
    });

    const texto =
      respuesta.output_text ||
      respuesta.output?.[0]?.content?.[0]?.text ||
      "No se pudo generar respuesta.";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        respuesta: texto,
        rag_usado: contexto.length > 0,
        modelo: "gpt-4o-mini + ADA-002"
      })
    };
  } catch (err) {
    console.error("ERROR MITIGA:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
