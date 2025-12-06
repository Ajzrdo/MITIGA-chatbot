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
  return Math.sqrt(v.reduce((sum, val, i) => sum + val * val, 0));
}
function cosineSimilarity(a, b) {
  return dot(a, b) / (magnitude(a) * magnitude(b));
}

/* RAG filtrado */
async function buscarContexto(pregunta) {
  if (!fs.existsSync(embeddingsFile)) return "";

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

  const top = puntuaciones.sort((a, b) => b.score - a.score).slice(0, 2);

  const resumen = top
    .map((r) => "- " + r.texto.replace(/\n+/g, " ").slice(0, 400))
    .join("\n");

  return `CONTEXTO_RAG:\n${resumen}`;
}

/* Memoria simulada ligera */
function generarMemoriaSimulada() {
  return `
MEMORIA_SIMULADA:
- Paciente probable: fase inicial-intermedia
- Riesgos activos: irritabilidad, entornos ruidosos, sobrecarga del cuidador
- Objetivo probable: entender situación, anticipar riesgo, registrar
`.trim();
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
    const contextoRAG = await buscarContexto(pregunta);
    const memoria = generarMemoriaSimulada();

    /* SUPER PROMPT MITIGA */
    const promptSistema = `
Eres el Asistente MITIGA, herramienta sociosanitaria avanzada creada por Dekipling y validada con HULP/IdiPAZ.
Tu misión:
- Analizar situaciones reales en el domicilio
- Identificar señales tempranas de riesgo
- Detectar posibles **Eventos Médicos Evitables (EMEs)**
- Dar acciones prácticas
- Ayudar a registrar correctamente
- Preparar información útil para el neurólogo

NO diagnosticas. NO ajustas medicación. NO sustituyes consulta médica.

MARCO METODOLÓGICO MITIGA:
Evalúa en cada respuesta:
1) Cognición
2) Conducta y emoción
3) ABVD
4) Salud física
5) Adherencia
6) Entorno

META-RAZONAMIENTO:
Antes de responder:
- Identifica el desencadenante
- Evalúa impacto funcional
- Determina riesgo o EME
- Sugiere qué observar
- Indica qué registrar
- Explica qué comunicar al neurólogo

FORMATO OBLIGATORIO DE RESPUESTA:
1. Qué está ocurriendo
2. Por qué importa
3. Posibles EMEs
4. Qué observar
5. Qué hacer ahora
6. Cómo registrarlo en MITIGA
7. Qué comunicar al neurólogo

${memoria}

${contextoRAG}
`;

    const mensajes = [
      { role: "system", content: promptSistema },
      ...messages,
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: mensajes,
      temperature: 0.45,
      top_p: 0.85,
      max_tokens: 750,
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
