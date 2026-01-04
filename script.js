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
    const html = marked.parse(text, { breaks: false });

    msg.innerHTML = `
    <div class="bot-header">
      <img src="images/mitiga-icon.png" class="mitiga-logo">
      <span>MITIGA</span>
    </div>
    <div class="message-content">${html}</div>
  `;
  } else {
    // Usuario (y cualquier otro sender) como texto plano
    msg.innerHTML = `<div class="message-content"></div>`;
    msg.querySelector(".message-content").textContent = text;
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
conversationHistory.forEach(m => {
  const sender = m.role === "assistant" ? "bot" : "user";
  appendMessage(sender, m.content);
});

// =============================
// TYPING INDICATOR
// =============================
function showTyping() {
  typingIndicator.classList.remove("hidden");
  typingIndicator.classList.add("show");
  chatMessages.appendChild(typingIndicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  const icon = typingIndicator.querySelector(".typing-icon");
  if (icon) icon.classList.add("mitiga-heartbeat");
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

  let isTimeout = false;

  const timeoutId = setTimeout(() => {
    isTimeout = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const messagesForAPI = conversationHistory.filter(
      m => m.role === "user"
    );

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messagesForAPI }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);


    hideTyping();

    if (!res.ok) {
      appendMessage(
        "bot",
        "He tenido un problema puntual al preparar la respuesta.\n\n" +
        "No es grave y suele resolverse al intentarlo de nuevo.\n" +
        "Si quieres, puedes volver a enviar la pregunta."
      );
      return;
    }

    const data = await res.json();
    const botReply =
      data.reply ??
      data.message ??
      data.content ??
      "MITIGA no pudo responder.";

    function splitMITIGAResponse(text) {
      const trimmed = text.trim();

      // Buscar último salto de línea
      const lastBreak = trimmed.lastIndexOf("\n");
      if (lastBreak === -1) {
        return { main: trimmed, question: null };
      }

      const main = trimmed.slice(0, lastBreak).trim();
      const lastLine = trimmed.slice(lastBreak).trim();

      // Regla MITIGA: una sola pregunta, siempre al final
      if (lastLine.endsWith("?")) {
        return {
          main,
          question: lastLine
        };
      }

      return { main: trimmed, question: null };
    }

    const { main, question } = splitMITIGAResponse(botReply);

    // Viñeta principal
    appendMessage("bot", main);

    // Viñeta de pregunta (si existe)
    if (question) {
      appendMessage("bot", question);
    }

    // Historial: se guarda igual que antes (mensaje único)
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

    if (isTimeout) {
      appendMessage(
        "bot",
        "La respuesta está tardando más de lo habitual.\n\n" +
        "Puede ser por la conexión o porque la pregunta requiere más tiempo.\n" +
        "Si quieres, espera unos segundos o vuelve a intentarlo."
      );
    } else {
      appendMessage(
        "bot",
        "He tenido un problema puntual al preparar la respuesta.\n\n" +
        "No es grave y suele resolverse al intentarlo de nuevo.\n" +
        "Si quieres, puedes volver a enviar la pregunta."
      );
    }
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
