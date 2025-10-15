MITIGA-chatbot – Guía de instalación y despliegue seguro
========================================================

Este proyecto ejecuta el asistente MITIGA usando la API de OpenAI
a través de un proxy seguro alojado en Netlify Functions.
De este modo, tu clave API nunca se expone al navegador.


1️⃣ Estructura de carpetas
--------------------------
MITIGA-chatbot/
│
├── index.html                     → interfaz del chatbot (sin cambios visuales)
├── script.js                      → lógica del chat, animación y memoria local
├── README.txt                     → este documento
│
└── netlify/
    └── functions/
        └── chatgpt-proxy.js       → proxy seguro (protege la clave API)
└── images/
    ├── mitiga-logo.png
    ├── mitiga-icon.png
    └── mitiga-background.jpg


2️⃣ Requisitos
--------------
- Tener una cuenta gratuita en **Netlify** → https://www.netlify.com/
- Disponer de una **clave API de OpenAI** → https://platform.openai.com/account/api-keys
- Tener **Node.js** instalado (solo si deseas probar localmente)
- Carpeta completa “MITIGA-chatbot” con los archivos anteriores


3️⃣ Configuración de variables seguras en Netlify
-------------------------------------------------
1. Entra en tu panel de Netlify y abre el sitio MITIGA-chatbot.
2. Ve a:  *Site settings → Environment variables*.
3. Añade las siguientes variables:

   • `OPENAI_API_KEY` = tu clave personal de OpenAI  
   • `OPENAI_MODEL`   = gpt-5-instant   (puedes cambiarlo por gpt-4o, gpt-4-turbo, etc.)

4. Guarda los cambios.

   👉 Tu clave quedará protegida y no aparecerá nunca en el código público.


4️⃣ Despliegue del proyecto
----------------------------
Opción A – Desde el navegador (rápido y sencillo)
------------------------------------------------
1. Entra en https://app.netlify.com/drop
2. Arrastra y suelta la carpeta completa `MITIGA-chatbot/`
3. Netlify generará tu sitio en pocos segundos, por ejemplo:
   → https://mitiga-chatbot.netlify.app
4. Accede a la URL y prueba el asistente MITIGA.

Opción B – Desde VS Code usando Netlify CLI
--------------------------------------------
1. Abre la carpeta del proyecto en Visual Studio Code.
2. Instala la herramienta de Netlify:
   ```bash
   npm install -g netlify-cli
