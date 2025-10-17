MITIGA-CHATBOT (versión con RAG local y GPT-4o)
================================================

🧠 Descripción
--------------
MITIGA-chatbot es un asistente sociosanitario que utiliza el modelo GPT-4o de OpenAI 
y una base vectorial local (Chroma) para responder de forma fundamentada en los 
documentos MITIGA:

- MITIGA_Método_práctico_CFP.txt
- MITIGA_Manual_Usuario.txt

El sistema combina:
- Interfaz tipo ChatGPT (escritura fluida y pausas naturales).
- Razonamiento semántico local (RAG).
- Cumplimiento RGPD (los documentos no salen de tu entorno).
- Proxy seguro (la API key nunca se expone en el navegador).


📂 Estructura del proyecto
--------------------------
MITIGA-chatbot/
│
├── index.html                         → interfaz del asistente MITIGA
├── script.js                          → lógica de animación y comunicación
│
├── netlify/
│   └── functions/
│       ├── chatgpt-proxy.js           → proxy seguro + búsqueda RAG
│       └── procesar_referencias.js    → script de indexación local
│
├── referencias/
│   ├── MITIGA_Método_práctico_CFP.txt
│   ├── MITIGA_Manual_Usuario.txt
│
└── .env                               → clave OpenAI privada


⚙️ Requisitos
-------------
1. Node.js (v18 o superior)
2. Cuenta OpenAI con API key
3. Netlify CLI instalado (opcional para probar en local)

Instalación del CLI:
    npm install -g netlify-cli


🔐 Configuración de entorno
---------------------------
1️⃣ En la raíz del proyecto, crea un archivo llamado `.env` con el contenido:

    OPENAI_API_KEY=tu_clave_aquí

2️⃣ Instala las dependencias necesarias:

    npm install openai chromadb dotenv


📘 Indexar los documentos MITIGA
--------------------------------
Este paso crea la base de datos vectorial local (`chroma.db`) que permitirá al 
asistente responder con información real de tus textos MITIGA.

Ejecuta desde la raíz del proyecto:

    node netlify/functions/procesar_referencias.js

Verás en la consola mensajes como:
    🧠 Iniciando indexación de documentos MITIGA...
    📄 Procesando MITIGA_Método_práctico_CFP.txt...
    ✅ Indexación completada.

Esto generará la base `chroma.db` en la carpeta `./chroma` de tu entorno local.


🧩 Probar en local
------------------
1️⃣ Inicia el servidor de desarrollo:

    netlify dev

2️⃣ Abre el navegador en:
    http://localhost:8888/

3️⃣ Prueba escribiendo:
    ¿Qué es un EME?
    ¿Cómo se evalúan los cambios de comportamiento?
    ¿Qué debo observar antes de la próxima consulta médica?

Las respuestas se generarán a partir de tus documentos MITIGA.


🚀 Desplegar en producción
--------------------------
1️⃣ Asegúrate de tener tu cuenta Netlify activa.
2️⃣ Ejecuta:

    netlify deploy --prod

3️⃣ El sitio quedará disponible en:
    https://mitiga-chatbot.netlify.app/


📚 Mantenimiento
----------------
- Si actualizas los textos MITIGA, vuelve a ejecutar:

      node netlify/functions/procesar_referencias.js

- Puedes borrar la base `chroma.db` para regenerarla desde cero si es necesario.


💬 Notas de diseño
------------------
- Las respuestas ocupan todo el ancho disponible del chat.
- La escritura se realiza de forma progresiva con pausas naturales 
  (simula la experiencia de ChatGPT).
- El botón “Nueva conversación” borra el historial y muestra nuevamente 
  la pantalla inicial de bienvenida.

Si la app deja de responder:
- Verifica tu `.env` (clave correcta).
- Confirma que los archivos .txt existen en `/referencias/`.
- Comprueba que se generó la base `chroma.db` correctamente.


🤝 Créditos
-----------
Proyecto MITIGA desarrollado por Dekipling S.L.
Integración IA y soporte técnico asistido con GPT-5 (OpenAI).

Versión: 2025-10-16
