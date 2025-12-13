// =============================
// CONFIG
// =============================
const API_URL = "https://api.mitiga-alzheimer.com";
const REQUEST_TIMEOUT_MS = 20000;

// =============================
// ELEMENTOS DOM
// =============================
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const chatMessages = document.getElementById("chatMessages");
const typingIndicator = document.getElementById("typingIndicator");
const startScreen = document.getElementById("start-screen");

// =============================
// ESTADO
// =============================
let conversationHistory = JSON.parse(localStorage.getItem("conversationHistory") || "[]");
let activeRequestController = null;

// =============================
// UTILIDAD: Añadir mensajes al chat
// =============================
function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);

  if (sender === "bot") {
    msg.innerHTML = `
      <div class="bot-header">
        <img src="images/mitiga-icon.png">
        <span>MITIGA</span>
      </div>
      <div class="message-content">${text}</div>
    `;
  } else {
    msg.innerHTML = `<div class="message-content">${text}</div>`;
  }

  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Restaurar conversación previa
conversationHistory.forEach(m => appendMessage(m.role, m.content));

// =============================
// FUNCIÓN PRINCIPAL: enviar mensaje
// =============================
async function sendMessage() {
  const userText = userInput.value.trim();
  if (!userText) return;

  startScreen.classList.add("hidden");

  // Mostrar mensaje del usuario
  appendMessage("user", userText);

  // Guardar en historial
  conversationHistory.push({ role: "user", content: userText });
  localStorage.setItem("conversationHistory", JSON.stringify(conversationHistory));

  userInput.value = "";

  // Mostrar indicador
  typingIndicator.classList.remove("hidden");

  // Cancelar petición anterior si existe
  if (activeRequestController) activeRequestController.abort();
  const controller = new AbortController();
  activeRequestController = controller;

  // Construir payload
  const payload = {
    messages: conversationHistory
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    typingIndicator.classList.add("hidden");

    if (!res.ok) {
      appendMessage("bot", `Error HTTP ${res.status}`);
      return;
    }

    const data = await res.json();
    const botReply = data.reply || "MITIGA no pudo responder.";

    appendMessage("bot", botReply);

    conversationHistory.push({ role: "assistant", content: botReply });
    localStorage.setItem("conversationHistory", JSON.stringify(conversationHistory));

  } catch (err) {
    typingIndicator.classList.add("hidden");
    appendMessage("bot", "Error de conexión con MITIGA.");
  }
}

// =============================
// EVENTOS
// =============================
sendButton.addEventListener("click", sendMessage);

userInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Nuevo chat
document.getElementById("newChat").addEventListener("click", () => {
  localStorage.removeItem("conversationHistory");
  conversationHistory = [];
  chatMessages.innerHTML = "";
  startScreen.classList.remove("hidden");
});
