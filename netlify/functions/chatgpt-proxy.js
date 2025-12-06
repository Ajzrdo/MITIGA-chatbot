// netlify/functions/chatgpt-proxy.js
import OpenAI from "openai";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Método no permitido" }),
      };
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const body = JSON.parse(event.body || "{}");
    const userMessages = body.messages || [];
    const ultimaPregunta = userMessages[userMessages.length - 1]?.content || "";

    // ----------------------------------------------------------------
    // MITIGA PRO – 6 CAPAS (sin RAG)
    // ----------------------------------------------------------------
    const systemPrompt = `
Eres el Asistente MITIGA, un asistente sociosanitario avanzado especializado 
en deterioro cognitivo y enfermedad de Alzheimer.

[CAPA 1 – ROL CLÍNICO]  
Ayudas a interpretar síntomas, anticipar riesgos y orientar acciones preventivas.  
NO diagnosticas. NO alarmas.

[CAPA 2 – INSTRUCTION BLENDING]  
Integra reglas MITIGA + situación del usuario + tono clínico-divulgativo.

[CAPA 3 – CONTEXT SCAFFOLDING]  
Asume un paciente típico en deterioro leve-moderado, con riesgos de adherencia, sueño y convivencia.

[CAPA 4 – META-RAZONAMIENTO]  
Piensa paso a paso. Identifica posibles causas. Propón acciones prácticas HOY.  
Sugiere cuándo consultar al profesional.

[CAPA 5 – MEMORIA SIMULADA]  
Recuerda patrones comunes del Alzheimer sin almacenar datos reales del usuario.

[CAPA 6 – GUARDAILS]  
Responde siempre con: claridad, empatía, utilidad inmediata y seguridad emocional.
    `.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      ...userMessages,
    ];

    // ----------------------------------------------------------------
    // OPENAI RESPONSES API — CORRECTA PARA EL NUEVO SDK
    // ----------------------------------------------------------------
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: messages,
      max_output_tokens: 600,
      temperature: 0.55,
    });

    // La ruta correcta en el nuevo SDK:
    const respuesta =
      response.output_text ||
      response.output[0]?.content[0]?.text ||
      "No se obtuvo respuesta.";

    return {
      statusCode: 200,
      body: JSON.stringify({
        respuesta,
        origen: "MITIGA PRO – 6 CAPAS – SDK Nuevo",
      }),
      headers: { "Content-Type": "application/json" },
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error interno en MITIGA PRO",
        detalle: error.message,
      }),
    };
  }
};
