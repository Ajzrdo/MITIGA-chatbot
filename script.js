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
let conversationHistory = JSON.parse(
  localStorage.getItem("conversationHistory") || "[]"
);
let activeRequestController = null;

// =============================
// ANIMACIONES
// =============================
function fadeIn(element) {
  element.classList.add("fade-in");
  setTimeout(() => element.classList.remove("fade-in"), 600);
}

function heartbeatIcon(msgElement) {
  const icon = msgElement.querySelector(".mitiga-logo");
  if (icon) icon.classList.add("mitiga-heartbeat");
}

// =============================
// MENSAJES
// =============================
function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);

  if (sender === "bot") {
    msg.innerHTML = `
      <div class="bot-header">
        <img src="images/mitiga-icon.png" class="mitiga-logo">
        <span>MITIGA</span>
      </div>
      <div class="message-content">${text}</div>
    `;
  } else {
    msg.innerHTML = `<div class="message-content">${text}</div>`;
  }

  chatMessages.appendChild(msg);

  if (sender === "user") {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } else {
    msg.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}


// =============================
// HISTORIAL
// =============================
conversationHistory.forEach(m => appendMessage(m.role, m.content));

// =============================
// TYPING INDICATOR
// =============================
function showTyping() {
  typingIndicator.classList.remove("hidden");
  typingIndicator.classList.add("show");
  chatMessages.appendChild(typingIndicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
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
  localStorage.setItem(
    "conversationHistory",
    JSON.stringify(conversationHistory)
  );

  userInput.value = "";
  showTyping();

  if (activeRequestController) activeRequestController.abort();
  const controller = new AbortController();
  activeRequestController = controller;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversationHistory }),
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

    conversationHistory.push({
      role: "assistant",
      content: botReply
    });

    localStorage.setItem(
      "conversationHistory",
      JSON.stringify(conversationHistory)
    );

  } catch {
    hideTyping();
    appendMessage("bot", "Error de conexión con MITIGA.");
  }
}

// =============================
// NUEVO CHAT
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
