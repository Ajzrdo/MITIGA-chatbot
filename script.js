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

// Modal
const modal = document.getElementById("modal");
const confirmButton = document.getElementById("confirmButton");
const cancelButton = document.getElementById("cancelButton");

// =============================
// ESTADO
// =============================
let conversationHistory = JSON.parse(localStorage.getItem("conversationHistory") || "[]");
let activeRequestController = null;

// =============================
// FORMATEO A VIÑETAS (cuando procede)
// =============================
function formatAsBullets(text) {
  if (!text) return "";

  // Si ya contiene viñetas, no hacemos nada.
  if (text.includes("•")) return text;

  if (text.length < 220) return text;

  const parts = text.split(/\.\s+/).filter(p => p.trim() !== "");
  if (parts.length < 3) return text;

  return parts.map(p => `• ${p.trim()}.`).join("<br>");
}

// =============================
// Animación fade-in
// =============================
function fadeIn(element) {
  element.classList.add("fade-in");
  setTimeout(() => element.classList.remove("fade-in"), 600);
}

// =============================
// Animación heartbeat del icono
// =============================
function heartbeatIcon(msgElement) {
  const icon = msgElement.querySelector(".mitiga-logo");
  if (!icon) return;
  icon.classList.add("mitiga-heartbeat");
}

// =============================
// Añadir mensajes
// =============================
function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);

  if (sender === "bot") {
    const formatted = formatAsBullets(text);

    msg.innerHTML = `
      <div class="bot-header">
        <img src="images/mitiga-icon.png" class="mitiga-logo">
        <span>MITIGA</span>
      </div>
      <div class="message-content">${formatted}</div>
    `;

    chatMessages.appendChild(msg);

    fadeIn(msg);
    heartbeatIcon(msg);

  } else {
    msg.innerHTML = `<div class="message-content">${text}</div>`;
    chatMessages.appendChild(msg);
    fadeIn(msg);
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// =============================
// Cargar historial previo
// =============================
conversationHistory.forEach(m => appendMessage(m.role, m.content));

// =============================
// Mostrar / ocultar indicador MITIGA
// =============================
function showTyping() {
  typingIndicator.classList.remove("hidden");
  typingIndicator.classList.add("show");
}

function hideTyping() {
  typingIndicator.classList.add("hidden");
  typingIndicator.classList.remove("show");
}

// =============================
// ENVÍO PRINCIPAL
// =============================
async function sendMessage() {
  const userText = userInput.value.trim();
  if (!userText) return;

  startScreen.classList.add("hidden");
  appendMessage("user", userText);

  conversationHistory.push({ role: "user", content: userText });
  localStorage.setItem("conversationHistory", JSON.stringify(conversationHistory));

  userInput.value = "";
  showTyping();

  if (activeRequestController) activeRequestController.abort();
  const controller = new AbortController();
  activeRequestController = controller;

  const payload = { messages: conversationHistory };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    hideTyping();

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
    hideTyping();
    appendMessage("bot", "Error de conexión con MITIGA.");
  }
}

// =============================
// NUEVO CHAT (con confirmación)
// =============================
document.getElementById("newChat").addEventListener("click", () => {
  modal.classList.remove("hidden");
  modal.classList.add("show");
});

confirmButton.addEventListener("click", () => {
  modal.classList.remove("show");
  modal.classList.add("hidden");

  localStorage.removeItem("conversationHistory");
  conversationHistory = [];
  chatMessages.innerHTML = "";
  startScreen.classList.remove("hidden");
});

cancelButton.addEventListener("click", () => {
  modal.classList.remove("show");
  modal.classList.add("hidden");
});

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
