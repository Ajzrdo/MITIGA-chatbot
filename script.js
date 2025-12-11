// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const API_URL = "https://api.mitiga-alzheimer.com"; // Worker correcto

// Elementos del DOM
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const chatMessages = document.getElementById("chatMessages");
const typingIndicator = document.getElementById("typingIndicator");

// Historial de conversación
let conversationHistory = JSON.parse(localStorage.getItem("conversationHistory")) || [];

// ------------------------------------------------------------
// FUNCIONES AUXILIARES (UI)
// ------------------------------------------------------------
function appendMessage(text, sender) {
    const bubble = document.createElement("div");
    bubble.className = sender === "user" ? "user-message" : "bot-message";
    bubble.innerText = text;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function appendMessageGradual(text, sender) {
    const bubble = document.createElement("div");
    bubble.className = sender === "user" ? "user-message" : "bot-message";
    bubble.innerHTML = "";
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    for (let i = 0; i <= text.length; i++) {
        bubble.innerText = text.substring(0, i);
        await new Promise(res => setTimeout(res, 10));
    }
}

// ------------------------------------------------------------
// ENVÍO DE MENSAJE
// ------------------------------------------------------------
async function sendMessage() {
    const text = userInput.value.trim();   // ← ESTE ERA EL ERROR PRINCIPAL

    if (!text) return;

    appendMessage(text, "user");
    userInput.value = "";
    typingIndicator.classList.remove("hidden");

    conversationHistory.push({ role: "user", content: text });
    localStorage.setItem("conversationHistory", JSON.stringify(conversationHistory));

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: conversationHistory })
        });

        if (!res.ok) {
            appendMessage("Error: HTTP " + res.status, "bot");
            typingIndicator.classList.add("hidden");
            return;
        }

        const data = await res.json();
        const botText = data.reply || "MITIGA no pudo responder correctamente.";

        conversationHistory.push({ role: "assistant", content: botText });
        localStorage.setItem("conversationHistory", JSON.stringify(conversationHistory));

        await appendMessageGradual(botText, "bot");

    } catch (error) {
        appendMessage("Error de conexión con MITIGA.", "bot");
        console.error(error);
    }

    typingIndicator.classList.add("hidden");
}

// ------------------------------------------------------------
// EVENTOS
// ------------------------------------------------------------
sendButton.addEventListener("click", sendMessage);

userInput.addEventListener("keypress", e => {
    if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
    }
});
