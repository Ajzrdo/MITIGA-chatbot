/* ==========================================================================
   MITIGA Chatbot – Proxy seguro para Netlify Functions
   --------------------------------------------------------------------------
   Este archivo actúa como intermediario entre el front-end (script.js)
   y la API de OpenAI. La clave API se guarda como variable protegida
   en Netlify (OPENAI_API_KEY). También controla el modelo, temperatura
   y longitud de las respuestas.
   ========================================================================== */

import fetch from "node-fetch";

export async function handler(event) {
  try {
    // Extrae el cuerpo del mensaje (prompt + usuario)
    const body = JSON.parse(event.body || "{}");

    // Clave API y modelo desde variables de entorno seguras
    const apiKey = process.env.OPENAI_API_KEY;
    const modelo = process.env.OPENAI_MODEL || "gpt-5-instant";

    // Validación de seguridad
    if (!apiKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Falta la clave API. Define OPENAI_API_KEY en Netlify.",
        }),
      };
    }

    // Llamada segura a la API de OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelo,
        messages: body.messages,
        temperature: 0.6, // nivel de creatividad (0 exacto, 1 más libre)
        max_tokens: 600,  // longitud máxima de respuesta
      }),
    });

    const data = await response.text();

    return {
      statusCode: 200,
      body: data,
    };
  } catch (error) {
    console.error("❌ Error en proxy:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error interno del servidor (proxy MITIGA).",
      }),
    };
  }
}
