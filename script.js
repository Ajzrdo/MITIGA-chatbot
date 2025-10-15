/* ==========================================================================
   MITIGA Chatbot – Versión actualizada y segura para Netlify
   Basada en tu script original: se mantienen estructura, animaciones y UX.
   ========================================================================== */

/* --------------------------------------------------
   VARIABLES PRINCIPALES
   -------------------------------------------------- */
const chat = document.getElementById("chat");
const userInput = document.getElementById("userInput");
let primeraVez = true;

/* --------------------------------------------------
   CONFIGURACIÓN DEL TEXTAREA
   -------------------------------------------------- */
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = userInput.scrollHeight + "px";
});

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    startChat();
  }
});

/* --------------------------------------------------
   FUNCIÓN PRINCIPAL DE ENVÍO
   -------------------------------------------------- */
async function sendMessage() {
  const userText = userInput.value.trim();
  if (!userText) return;

  appendMessage(userText, "user");
  userInput.value = "";
  userInput.style.height = "40px";

  /* --------------------------------------------------
     PROMPT MITIGA (detallado y semántico)
     -------------------------------------------------- */
  const promptSistema = `
Eres MITIGA, un asistente sociosanitario diseñado para acompañar a familias y cuidadores de personas con Alzheimer u otros deterioros cognitivos.

🎯 Tu propósito:
- Ayudar a comprender los cambios que se observan en la vida diaria del paciente.
- Sugerir, cuando proceda, en qué parte de MITIGA pueden registrarse esos cambios (*Síntomas e Incidencias*, *Registro de Medicación*, *Cambios en el Entorno*, etc.).
- Promover el uso de MITIGA como herramienta para la observación estructurada y la comunicación con el entorno médico y sociosanitario.
- Nunca sustituir la valoración médica ni ofrecer diagnósticos o tratamientos.

💬 Estilo y tono:
- Natural, sereno, empático y claro.
- Usa frases breves, evitando tecnicismos innecesarios.
- Habla como un acompañante que conoce la metodología MITIGA y su utilidad práctica.
- Si es necesario pedir más contexto, formula una **pregunta aclaratoria** en un globo nuevo, no dentro del mismo mensaje.
- Evita frases genéricas o comerciales como “Esto te puede ayudar a decidir qué hacer a continuación”.
- Si la información puede registrarse en MITIGA, sugiere que así se haga, de forma práctica y amable.

🧭 Formato de salida:
1️⃣ Primer globo → Respuesta principal.
2️⃣ Segundo globo → Pregunta aclaratoria (solo si es útil).

No incluyas marcas como “---” ni numeraciones al escribir. Limítate a los mensajes naturales.
  `;

  const typing = showTyping();

  try {
    // Llamada segura al proxy en Netlify
    const res = await fetch("/.netlify/functions/chatgpt-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: promptSistema },
          { role: "user", content: userText },
        ],
      }),
    });

    hideTyping(typing);

    if (!res.ok) {
      appendMessage("⚠️ No se pudo obtener respuesta de MITIGA.", "bot");
      return;
    }

    const data = await res.json();
    const texto = data.choices?.[0]?.message?.content || "";

    // Divide la respuesta en bloques (respuesta + aclaración)
    const partes = texto
      .split(/\n{2,}|(?<=\.)\s{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (let i = 0; i < partes.length; i++) {
      await appendMessageGradual(partes[i], "bot");
    }
  } catch (error) {
    hideTyping(typing);
    console.error("Error de conexión:", error);
    appendMessage("❌ Error de conexión con el servidor.", "bot");
  }
}

/* --------------------------------------------------
   FUNCIÓN PARA AÑADIR MENSAJES (usuario o bot)
   -------------------------------------------------- */
function appendMessage(text, sender) {
  const block = document.createElement("div");
  block.classList.add("message-block", sender);

  if (sender === "bot") {
    block.innerHTML = `
      <div class="bot-header">
        <img src="images/mitiga-icon.png" alt="MITIGA">
        <span>MITIGA</span>
      </div>
      <div class="bot-body">${text}</div>
    `;
  } else {
    const userMsg = document.createElement("div");
    userMsg.classList.add("user");
    userMsg.textContent = text;
    block.appendChild(userMsg);
  }

  chat.appendChild(block);
  chat.scrollTop = chat.scrollHeight;
  guardarConversacion(sender, text);
}

/* --------------------------------------------------
   EFECTO DE ESCRITURA GRADUAL
   -------------------------------------------------- */
async function appendMessageGradual(text, sender) {
  const block = document.createElement("div");
  block.classList.add("message-block", sender);
  block.innerHTML = `
    <div class="bot-header">
      <img src="images/mitiga-icon.png" alt="MITIGA">
      <span>MITIGA</span>
    </div>
    <div class="bot-body"></div>
  `;
  chat.appendChild(block);
  const botBody = block.querySelector(".bot-body");

  let i = 0;
  const velocidad = 18;
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      botBody.innerHTML = text.slice(0, i);
      chat.scrollTop = chat.scrollHeight;
      i++;
      if (i > text.length) {
        clearInterval(interval);
        guardarConversacion(sender, text);
        resolve();
      }
    }, velocidad);
  });
}

/* --------------------------------------------------
   INDICADOR “ESCRIBIENDO...”
   -------------------------------------------------- */
function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("message-block", "bot");
  typing.innerHTML = `
    <div class="bot-header">
      <img src="images/mitiga-icon.png" alt="MITIGA">
      <span>MITIGA</span>
    </div>
    <div class="bot-body"><i>...</i></div>
  `;
  chat.appendChild(typing);
  chat.scrollTop = chat.scrollHeight;
  return typing;
}

function hideTyping(el) {
  if (el && el.parentNode) el.remove();
}

/* --------------------------------------------------
   GESTIÓN DE CONVERSACIÓN (MEMORIA LOCAL)
   -------------------------------------------------- */
function guardarConversacion(rol, texto) {
  let historial = JSON.parse(localStorage.getItem("mitigaHistorial")) || [];
  historial.push({ rol, texto, fecha: new Date().toISOString() });
  localStorage.setItem("mitigaHistorial", JSON.stringify(historial));
}

function cargarConversacion() {
  const historial = JSON.parse(localStorage.getItem("mitigaHistorial")) || [];
  historial.forEach((msg) => appendMessage(msg.texto, msg.rol));
}

/* --------------------------------------------------
   INICIO DEL CHAT
   -------------------------------------------------- */
function startChat() {
  const startScreen = document.getElementById("start-screen");
  if (startScreen) {
    startScreen.classList.add("hidden");
    setTimeout(() => startScreen.remove(), 600);
  }

  if (primeraVez) {
    primeraVez = false;
    cargarConversacion();
  }

  sendMessage();
}

/* --------------------------------------------------
   REINICIAR CONVERSACIÓN (con confirmación)
   -------------------------------------------------- */
function reiniciarConversacion() {
  // Crea el modal solo si no existe
  if (document.getElementById("modalReiniciar")) return;

  const modalHTML = `
    <div id="modalReiniciar" style="
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    ">
      <div style="
        background: #fff;
        padding: 24px;
        border-radius: 12px;
        max-width: 320px;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      ">
        <h3 style="color:#581339; margin-top:0;">¿Comenzar una nueva conversación?</h3>
        <p style="color:#444; font-size:15px;">Se borrará el historial actual de MITIGA.</p>
        <div style="margin-top:20px; display:flex; justify-content:space-around;">
          <button id="btnCancelarReiniciar" style="
            background:#ccc; border:none; border-radius:6px;
            padding:10px 16px; cursor:pointer; font-weight:600;
          ">Cancelar</button>
          <button id="btnConfirmarReiniciar" style="
            background:#581339; color:#fff; border:none; border-radius:6px;
            padding:10px 16px; cursor:pointer; font-weight:600;
          ">Sí, reiniciar</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const modal = document.getElementById("modalReiniciar");
  const btnCancelar = document.getElementById("btnCancelarReiniciar");
  const btnConfirmar = document.getElementById("btnConfirmarReiniciar");

  // Acción al cancelar
  btnCancelar.addEventListener("click", () => modal.remove());

  // Acción al confirmar
  btnConfirmar.addEventListener("click", () => {
    // 1. Eliminar historial guardado
    localStorage.removeItem("mitigaHistorial");

    // 2. Borrar mensajes actuales
    document.querySelectorAll(".message-block").forEach((m) => m.remove());

    // 3. Reiniciar variable
    primeraVez = true;

    // 4. Volver a mostrar la pantalla inicial
    const startScreenHTML = `
      <div id="start-screen">
        <div id="start-screen-content">
          <img src="images/mitiga-icon.png" alt="MITIGA icon">
          <h1>Hola, soy MITIGA</h1>
          <p>Estoy aquí para ayudarte a comprender mejor los cambios que observas en el día a día del cuidado.</p>
        </div>
      </div>
    `;
    chat.insertAdjacentHTML("afterbegin", startScreenHTML);

    // 5. Cerrar modal
    modal.remove();
  });
}
