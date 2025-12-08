export async function onRequestPost({ request, env }) {
  // CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const body = await request.json();

    if (!body || !Array.isArray(body.messages)) {
      return Response.json(
        { error: "Formato inválido: falta 'messages' como array." },
        { status: 400, headers }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: env.SYSTEM_PROMPT },
          ...body.messages
        ]
      })
    });

    const data = await response.json();
    return Response.json(data, { headers });

  } catch (err) {
    return Response.json(
      { error: "Error interno: " + err.message },
      { status: 500, headers }
    );
  }
}
