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
  return Math.sqrt(v.reduce((sum, val, i) => sum + val * val, 0));
}
function cosineSimilarity(a, b) {
  return dot(a, b) / (magnitude(a) * magnitude(b));
}

/* --------------------------------------------------------------
   Búsqueda de contexto relevante (RAG)
-------------------------------------------------------------- */
async function buscarContexto(pregunta) {
  if (!fs.existsSync(embeddingsFile)) return "";

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

  const top = puntuaciones.sort((a, b) => b.score - a.score).slice(0, 5);
  return top.map((r) => r.texto).join("\n\n");
}

/* --------------------------------------------------------------
   Generar memoria simulada para MITIGA
-------------------------------------------------------------- */
function generarMemoriaSimulada(pregunta) {
  // Aquí puedes parsear datos reales si quieres
  // por ahora generamos un contenedor estándar
  return `
MEMORIA_SIMULADA:
- Paciente: fase inicial/intermedia (estimado)
- Riesgos activos posibles: alteración del entorno, irritabilidad, sobrecarga del cuidador
- Hipótesis MITIGA: evaluar desencadenantes ambientales, fatiga, adherencia, cambios recientes
- Objetivo probable del usuario: entender situación, anticipar riesgo, registrar correctamente
`.trim();
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
    const contextoRAG = await buscarContexto(pregunta);
    const memoria = generarMemoriaSimulada(pregunta);

    /* --------------------------------------------------------------
       CAPA 1, 4 y 6 — SUPER SYSTEM PROMPT MITIGA
    -------------------------------------------------------------- */
    const promptSistema = `
Eres el **Asistente MITIGA**, herramienta sociosanitaria avanzada creada por Dekipling y validada con HULP / IdiPAZ.
Tu misión es ayudar a familias y cuidadores a:
- Entender lo que ocurre en el domicilio,
- Identificar señales tempranas,
- Anticipar **Eventos Médicos Evitables (EMEs)**,
- Preparar información útil para el neurólogo,
- Registrar cambios con criterio MITIGA.

NO diagnosticas. NO ajustas medicación. NO sustituyes al médico.

### MARCO TÉCNICO MITIGA
Analiza siempre desde:
1) Cognición
2) Conducta / emoción
3) ABVD
4) Salud física
5) Medicación / adherencia
6) Entorno y convivencia

Aplica correlaciones MITIGA:
- estímulo → reacción → impacto funcional → riesgo → posible EME

### META-RAZONAMIENTO
Antes de responder:
1. Identifica el estímulo o desencadenante.
2. Evalúa impacto funcional.
3. Determina riesgos y EMEs.
4. Sugiere observaciones concretas.
5. Indica cómo registrar en MITIGA.
6. Define qué llevar al neurólogo.

### TONO
Empático, claro, profesional, no alarmista.

### FORMATO DE RESPUESTA (obligatorio)
1. Qué está ocurriendo  
2. Por qué importa  
3. Posibles EMEs asociados  
4. Qué observar  
5. Qué hacer ahora  
6. Cómo registrarlo en MITIGA  
7. Qué comunicar al neurólogo  

${memoria}

### CONTEXTO_RELEVANTE (embeddings)
${contextoRAG}
`;

    /* --------------------------------------------------------------
       Mezcla de capas: system + mensajes del usuario
    -------------------------------------------------------------- */
    const mensajes = [
      { role: "system", content: promptSistema },
      ...messages
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: mensajes,
      temperature: 0.45,
      top_p: 0.85,
      max_tokens: 750,
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
