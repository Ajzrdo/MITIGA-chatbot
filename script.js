const API_URL = "https://mitiga-api.ajzrdo.workers.dev/";
const REQUEST_TIMEOUT_MS = 45000;
const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const typingIndicator = document.getElementById("typingIndicator");
const startScreen = document.getElementById("start-screen");

let conversationHistory = [];
let activeRequestController = null;

/* -------------------------------------------
   Cargar historial previo
------------------------------------------- */
try {
  const stored = localStorage.getItem("conversationHistory");
  conversationHistory = stored ? JSON.parse(stored) : [];
} catch {
  localStorage.removeItem("conversationHistory");
}

/* -------------------------------------------
   Eventos
------------------------------------------- */
sendButton.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
userInput.addEventListener("focus", ocultarPantallaInicio);
userInput.addEventListener("input", ocultarPantallaInicio);

/* -------------------------------------------
   Inicialización de pantalla
------------------------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("modal");
  const confirmButton = document.getElementById("confirmButton");
  const cancelButton = document.getElementById("cancelButton");
  const newChatButton = document.getElementById("newChat");

  if (newChatButton) {
    newChatButton.addEventListener("click", () => {
      modal.classList.remove("hidden");
      modal.classList.add("show");
    });
  }

  if (confirmButton) {
    confirmButton.addEventListener("click", () => {
      modal.classList.remove("show");
      setTimeout(() => {
        modal.classList.add("hidden");
        Array.from(chatMessages.querySelectorAll(".message")).forEach((n) => n.remove());
        conversationHistory = [];
        localStorage.removeItem("conversationHistory");
        appendMessageGradual(
          "Hola 👋 Soy MITIGA. ¿Qué cambio o situación reciente te gustaría analizar hoy?",
          "bot"
        );
      }, 300);
    });
  }

  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      modal.classList.remove("show");
      setTimeout(() => modal.classList.add("hidden"), 300);
    });
  }

  // Renderizar historial
  for (const msg of conversationHistory) {
    appendMessage(msg.content, msg.role);
  }
});

/* -------------------------------------------
   ENVÍO DE MENSAJE (INTEGRADO CON WORKER V3)
------------------------------------------- */
async function sendMessage() {
    if (!userText || sendButton.disabled) return;

    appendMessage(userText, "user");
    userInput.value = "";
    ocultarPantallinicio();

    typingIndicator.classList.remove("hidden");
    chatMessages.scrollTop = chatMessages.scrollHeight;

    conversationHistory.push({ role: "user", content: userText });
    localStorage.setItem("conversationHistory", JSON.stringify(conversationHistory));

    // Evitar que la conversación crezca demasiado
    if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
    }

    let timeoutId;

    try {
        sendButton.disabled = true;

        if (activeRequestController) activeRequestController.abort();

        const controller = new AbortController();
        activeRequestController = controller;

        timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: conversationHistory
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        activeRequestController = null;

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        typingIndicator.classList.add("hidden");

        const botText = data.reply || "No se pudo obtener respuesta del asistente.";

        conversationHistory.push({ role: "assistant", content: botText });
        localStorage.setItem("conversationHistory", JSON.stringify(conversationHistory));

        await appendMessageGradual(botText, "bot");

    } catch (error) {
        typingIndicator.classList.add("hidden");
        console.error("ERROR:", error);
    }
}

/* -------------------------------------------
   INTERFAZ Y FORMATO
------------------------------------------- */
function ocultarPantallaInicio() {
  if (startScreen) {
    startScreen.classList.add("hidden");
    setTimeout(() => startScreen.remove(), 600);
  }
}

function createBotHeader() {
  const header = document.createElement("div");
  header.classList.add("bot-header");
  header.innerHTML = `
    <img src="images/mitiga-icon.png" alt="MITIGA" />
    <span>MITIGA</span>
  `;
  return header;
}

function appendMessage(text, sender = "bot") {
  const block = document.createElement("div");
  block.classList.add("message", sender);

  if (sender === "bot") {
    block.classList.add("has-header");
    block.appendChild(createBotHeader());
  }

  const content = document.createElement("div");
  content.classList.add("message-content");
  content.innerHTML = formatRichText(text);
  block.appendChild(content);

  chatMessages.appendChild(block);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* -------------------------------------------
   EFECTO DE ESCRITURA
------------------------------------------- */
async function appendMessageGradual(text, sender = "bot") {
  const parts = dividirTextoNatural(text);
  let first = true;

  for (const part of parts) {
    const block = document.createElement("div");
    block.classList.add("message", sender);

    if (sender === "bot" && first) {
      block.classList.add("has-header");
      block.appendChild(createBotHeader());
      first = false;
    }

    const content = document.createElement("div");
    content.classList.add("message-content");
    block.appendChild(content);

    chatMessages.appendChild(block);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    await mostrarGradualmente(content, formatRichText(part));
    await new Promise((r) => setTimeout(r, 250));
  }
}

/* -------------------------------------------
   UTILIDADES DE FORMATO
------------------------------------------- */
function dividirTextoNatural(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚ¿])/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function mostrarGradualmente(element, htmlText) {
  return new Promise((resolve) => {
    const temp = document.createElement("div");
    temp.innerHTML = htmlText;
    const plain = temp.textContent || "";
    let i = 0;

    const interval = setInterval(() => {
      if (i < plain.length) {
        element.innerHTML = plain.slice(0, i) + "▋";
        i++;
      } else {
        clearInterval(interval);
        element.innerHTML = htmlText;
        resolve();
      }
    }, 10);
  });
}

function formatRichText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/(^|\n)- (.*?)(?=\n|$)/g, "<ul><li>$2</li></ul>")
    .replace(/\n/g, "<br>");
}
