// ======================
// UTILIDADES
// ======================
function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ======================
// ELEMENTOS DOM
// ======================
const chatMessages = document.querySelector(".chat-messages");
const chatForm = document.querySelector(".chat-form");
const chatInput = document.querySelector(".chat-input");
const newChatBtn = document.querySelector(".new-chat");

// ======================
// ESTADO
// ======================
let conversationId = crypto.randomUUID();
let isWaitingResponse = false;

// ======================
// MENSAJES
// ======================
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
  }

  if (sender === "user") {
    msg.innerHTML = `
      <div class="message-content">${escapeHTML(text)}</div>
    `;
  }

  chatMessages.appendChild(msg);

  if (sender === "user") {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } else {
    msg.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// ======================
// INDICADOR DE ESCRITURA
// ======================
function showTypingIndicator() {
  const typing = document.createElement("div");
  typing.className = "message bot typing";
  typing.id = "typing-indicator";

  typing.innerHTML = `
    <div class="bot-header">
      <img src="images/mitiga-icon.png" class="mitiga-logo pulse">
      <span>MITIGA</span>
    </div>
    <div class="message-content">Estoy preparando tu respuesta…</div>
  `;

  chatMessages.appendChild(typing);
  typing.scrollIntoView({ behavior: "smooth", block: "start" });
}

function removeTypingIndicator() {
  const typing = document.getElementById("typing-indicator");
  if (typing) typing.remove();
}

// ======================
// ENVÍO DE MENSAJES
// ======================
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isWaitingResponse) return;

  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  appendMessage("user", userMessage);
  chatInput.value = "";

  showTypingIndicator();
  isWaitingResponse = true;

  try {
    const response = await fetch("https://api.mitiga-alzheimer.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        message: userMessage,
      }),
    });

    const data = await response.json();
    removeTypingIndicator();
    appendMessage("bot", data.reply);
  } catch (err) {
    removeTypingIndicator();
    appendMessage(
      "bot",
      "Ha ocurrido un error al procesar tu mensaje. Por favor, inténtalo de nuevo."
    );
  } finally {
    isWaitingResponse = false;
  }
});

// ======================
// NUEVO CHAT
// ======================
newChatBtn.addEventListener("click", () => {
  chatMessages.innerHTML = "";
  conversationId = crypto.randomUUID();
});
