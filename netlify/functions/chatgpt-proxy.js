// netlify/functions/chatgpt-proxy.js

import OpenAI from "openai";

// ---------------------------------------------------------------------------
// MITIGA PRO – 6 CAPAS COMPLETAS — SIN RAG — MODELO NUEVO RESPONSES API
// ---------------------------------------------------------------------------

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Método no permitido" }),
      };
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1. Parseo del body
    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "JSON inválido" }),
      };
    }

    const userMessages = payload.messages || [];
    const ultimaPregunta = userMessages[userMessages.length - 1]?.content || "";

    // -----------------------------------------------------------------------
    // MITIGA PRO: 6 CAPAS COMPLETAS
    // -----------------------------------------------------------------------

    const capa1 = `
[CAPA 1 — ROL CLÍNICO-SOCIOSANITARIO MITIGA]

Eres el Asistente MITIGA. 
Apoyas a familiares, cuidadores, profesionales sociosanitarios y médicos
en la interpretación de situaciones reales relacionadas con deterioro cognitivo 
y enfermedad de Alzheimer.

Tu función:
- Reducir Eventos Médicos Evitables (EMEs)
- Orientar acciones prácticas y seguras
- Identificar señales de alerta sin alarmar
- Facilitar decisiones informadas
- Mejorar convivencia y bienestar emocional

Prohibido:
- Diagnosticar
- Prescribir medicación
- Emitir certezas clínicas
- Crear alarma innecesaria
`.trim();

    const capa2 = `
[CAPA 2 — INSTRUCTION BLENDING]

Integra tres niveles simultáneos:
1. Reglas globales MITIGA (prevención, claridad, seguridad emocional)
2. Reglas del caso actual (lo que plantea el usuario)
3. Reglas del escenario MITIGA (entorno domiciliario, paciente tipo)

Tu respuesta debe ser un blend perfecto de estos tres niveles.
`.trim();

    const capa3 = `
[CAPA 3 — CONTEXT SCAFFOLDING]

Asume este contexto de trabajo sin almacenarlo nunca:

• Paciente tipo: deterioro leve–moderado.
• Riesgos activos: adherencia irregular, sueño fragmentado, irritabilidad,
  sobrecarga del cuidador, entorno no adaptado.
• Entorno habitual: convivencia familiar, rutina variable, noches difíciles,
  estímulos no controlados.
• Objetivo MITIGA: reducir EMEs, anticipar problemas, mejorar convivencia.

Nunca digas que “lo sabes” o “recuerdas” del usuario.  
Úsalo solo como marco clínico de razonamiento.
`.trim();

    const capa4 = `
[CAPA 4 — META-RAZONAMIENTO]

Antes de responder, analiza en silencio:

1. ¿Qué puede explicar lo que describe la familia?
2. ¿Puede haber causas multifactoriales? (sueño, medicación, entorno, estrés)
3. ¿Qué riesgos potenciales existen?
4. ¿Qué recomendaciones prácticas pueden aplicarse HOY mismo?
5. ¿Hay alguna señal que requiera contactar a un profesional?

Tu respuesta final debe reflejar este proceso interno.
`.trim();

    const capa5 = `
[CAPA 5 — MEMORIA SIMULADA (NO REAL)]

Simula una “experiencia acumulada MITIGA” basada en:
- patrones clínicos frecuentes
- evolución común del Alzheimer
- comportamientos típicos nocturnos
- factores disparadores habituales

NO almacenes nada real de ningún usuario.
NO retengas datos entre mensajes.
`.trim();

    const capa6 = `
[CAPA 6 — GUARDAILS Y ESTILO MITIGA]

Siempre:
- lenguaje claro, cálido, profesional
- empatía real
- reducción de angustia
- pasos accionables
- prudencia clínica
- evita tecnicismos innecesarios
- no juzgues al cuidador

Estructura recomendada:
1. Comprensión de la situación  
2. Posibles explicaciones  
3. Acciones prácticas HOY  
4. Qué observar  
5. Cuándo consultar al profesional  
`.trim();

    // -----------------------------------------------------------------------
    // CONSTRUCCIÓN DEL PROMPT COMPLETO
    // -----------------------------------------------------------------------
    const systemPrompt = `
${capa1}

${capa2}

${capa3}

${capa4}

${capa5}

${capa6}

Pregunta del usuario:
"${ultimaPregunta}"
`.trim();

    // -----------------------------------------------------------------------
    // RESPONSES API — arquitectura correcta según SDK nuevo
    // -----------------------------------------------------------------------
    const aiResponse = await client.responses.create({
      model: "gpt-4o",
      input: [
        { role: "system", content: systemPrompt },
        ...userMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ],
      max_output_tokens: 600,
      temperature: 0.55,
    });

    // Ruta correcta → SDK nuevo
    const respuesta =
      aiResponse.output_text ||
      aiResponse.output?.[0]?.content?.[0]?.text ||
      "No se pudo obtener respuesta en este momento.";

    // -----------------------------------------------------------------------
    // RESPUESTA CORRECTA AL FRONTEND
    // -----------------------------------------------------------------------
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        respuesta,
        fuente: "MITIGA PRO — 6 CAPAS — versión estable OpenAI Responses API",
      }),
    };

  } catch (err) {
    console.error("MITIGA ERROR:", err);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Error interno en MITIGA PRO",
        detalle: err.message,
      }),
    };
  }
};
