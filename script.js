const API_URL = "https://asistente.mitiga-alzheimer.com/";
const REQUEST_TIMEOUT_MS = 45000;
const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const typingIndicator = document.getElementById("typingIndicator");
const startScreen = document.getElementById("start-screen");
let conversationHistory = [];
let activeRequestController = null;

try {
  const storedHistory = localStorage.getItem("conversationHistory");
  conversationHistory = storedHistory ? JSON.parse(storedHistory) : [];
} catch (error) {
  console.warn("⚠️ Historial de conversación corrupto. Se reinicia.", error);
  localStorage.removeItem("conversationHistory");
}

function insertBeforeIndicator(block) {
  if (typingIndicator && typingIndicator.parentElement === chatMessages) {
    chatMessages.insertBefore(block, typingIndicator);
  } else {
    chatMessages.appendChild(block);
  }
}

/* --------------------------------------------------------------
   EVENTOS PRINCIPALES
-------------------------------------------------------------- */
sendButton.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
userInput.addEventListener("focus", ocultarPantallaInicio);
userInput.addEventListener("input", ocultarPantallaInicio);

/* --------------------------------------------------------------
   INICIALIZACIÓN DE LA PANTALLA
-------------------------------------------------------------- */
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
        Array.from(chatMessages.querySelectorAll(".message")).forEach((node) =>
          node.remove()
        );
        if (typingIndicator && !chatMessages.contains(typingIndicator)) {
          chatMessages.appendChild(typingIndicator);
        }
        conversationHistory = [];
        localStorage.removeItem("conversationHistory");
        appendMessageGradual("Hola 👋 Soy MITIGA. ¿Qué cambio o situación reciente te gustaría analizar hoy?", "bot");
      }, 300);
    });
  }

  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      modal.classList.remove("show");
      setTimeout(() => modal.classList.add("hidden"), 300);
    });
  }

  // Cargar historial previo
  if (conversationHistory.length > 0) {
    conversationHistory.forEach((msg) => {
      appendMessage(msg.content, msg.role === "user" ? "user" : "bot");
    });
  }
});

/* --------------------------------------------------------------
   ENVÍO DE MENSAJE
-------------------------------------------------------------- */
async function sendMessage() {
  const userText = userInput.value.trim();
  if (!userText) return;

  if (sendButton.disabled) {
    return;
  }

  appendMessage(userText, "user");
  userInput.value = "";
  ocultarPantallaInicio();

  typingIndicator.classList.remove("hidden");
  typingIndicator.classList.add("show");
  chatMessages.scrollTop = chatMessages.scrollHeight;

  conversationHistory.push({ role: "user", content: userText });
  localStorage.setItem("conversationHistory", JSON.stringify(conversationHistory));

  // 🔹 Limitar el historial para evitar exceso de tokens
  const MAX_HISTORY = 6;
  conversationHistory = conversationHistory.slice(-MAX_HISTORY);

  let timeoutId;

  try {
    sendButton.disabled = true;

    if (activeRequestController) {
      activeRequestController.abort();
    }

    const controller = new AbortController();
    activeRequestController = controller;
    timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    timeoutId = null;
    activeRequestController = null;

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    typingIndicator.classList.remove("show");
    typingIndicator.classList.add("hidden");

    const botText =
      data?.choices?.[0]?.message?.content || "No se pudo obtener respuesta de MITIGA.";

    conversationHistory.push({ role: "assistant", content: botText });
    localStorage.setItem("conversationHistory", JSON.stringify(conversationHistory));

    await appendMessageGradual(botText, "bot");
  } catch (error) {
    const isAbortError = error.name === "AbortError";
    console.error("❌ Error al conectar con MITIGA:", error);
    typingIndicator.classList.remove("show");
    typingIndicator.classList.add("hidden");

    const errorMessage = isAbortError
      ? "La solicitud tardó demasiado y se canceló. Intenta nuevamente."
      : (error.message || "Error al conectar con MITIGA. Intenta nuevamente.");

    appendMessage(errorMessage, "bot");
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    activeRequestController = null;
    sendButton.disabled = false;
  }
}

/* --------------------------------------------------------------
   UTILIDADES DE INTERFAZ
-------------------------------------------------------------- */
function ocultarPantallaInicio() {
  if (startScreen) {
    startScreen.classList.add("hidden");
    setTimeout(() => startScreen.remove(), 600);
  }
}

/* --------------------------------------------------------------
   GESTIÓN DE MENSAJES
-------------------------------------------------------------- */
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
  insertBeforeIndicator(block);

  // Auto-scroll
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* --------------------------------------------------------------
   EFECTO DE ESCRITURA GRADUAL
-------------------------------------------------------------- */
async function appendMessageGradual(text, sender = "bot") {
  const partes = dividirTextoNatural(text);
  let esPrimerBloque = true;
  for (const parte of partes) {
    const block = document.createElement("div");
    block.classList.add("message", sender);

    if (sender === "bot" && esPrimerBloque) {
      block.classList.add("has-header");
      block.appendChild(createBotHeader());
      esPrimerBloque = false;
    }

    const content = document.createElement("div");
    content.classList.add("message-content");
    block.appendChild(content);
    insertBeforeIndicator(block);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    await mostrarGradualmente(content, formatRichText(parte));
    await new Promise((r) => setTimeout(r, 250));
  }
}

/* --------------------------------------------------------------
   UTILIDADES DE FORMATO Y DIVISIÓN DE TEXTO
-------------------------------------------------------------- */
function dividirTextoNatural(text) {
  // Divide en frases largas o párrafos, sin romper frases cortas.
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚ¿])/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function mostrarGradualmente(element, htmlText) {
  return new Promise((resolve) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlText;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";
    let i = 0;
    element.innerHTML = "";

    const interval = setInterval(() => {
      if (i < plainText.length) {
        element.innerHTML = plainText.slice(0, i) + "▋";
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
  // Permite negritas, viñetas naturales y saltos de línea.
  return text
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/(^|\n)- (.*?)(?=\n|$)/g, "<ul><li>$2</li></ul>")
    .replace(/\n/g, "<br>");
}
