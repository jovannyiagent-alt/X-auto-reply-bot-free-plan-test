// ===============================
// Configuración
// ===============================
const N8N_WEBHOOK_URL = "https://n8n.neurozenlab.ovh/webhook/getTweets";
const N8N_WEBHOOK_URL2 = "https://n8n.neurozenlab.ovh/webhook/getComments";
const N8N_WEBHOOK_URL3 = "https://n8n.neurozenlab.ovh/webhook/getResponseAI";
const N8N_WEBHOOK_URL4 = "https://n8n.neurozenlab.ovh/webhook/getPublishReply";
const WAIT_TIME_MS = .04 * 60 * 1000; // 15 minutos

// ===============================
// Elementos del DOM
// ===============================
const btn = document.getElementById("sendDataBtn");
const palabraClave = document.getElementById("keyword");
const tweetsContainer = document.getElementById("tweetsContainer");
// ===============================
// variables globales
// ===============================
let tweetsCached = {};
let selectedTweetId = null; 
// ===============================
// Evento principal
// ===============================
btn.addEventListener("click", async () => {
  const payload = {
    keyword: palabraClave.value.trim(),
    timestamp: new Date().toISOString()
  };

  if (!payload.keyword) {
    alert("Ingresa una palabra clave");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Procesando...";

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("Error al conectar con n8n");
    }

    const data = await response.json();
    console.log("Respuesta n8n:", data);

    renderResults(data);

  } catch (error) {
    console.error(error);
    alert("Error enviando datos a n8n");
  } finally {
    btn.disabled = true;
    btn.textContent = "Procesado";
    btn.style.backgroundColor = "#4caf50";
  }
});

// ===============================
// Render de Tweets + Botones
// ===============================
function renderResults(data) {
  // tweetsContainer.innerHTML = "";
  const tweetsTitle = document.getElementById("tweetsTitle");
  const tweetsHidden = document.getElementById("tweetsEmpty");
  
  if (!data.tweets || data.tweets.length === 0) {
    tweetsTitle.classList.add("hidden");
    tweetsContainer.innerHTML = "<p class='empty'>No hay tweets encontrados</p>";
    return;
  }
  tweetsHidden.classList.add("hidden");
  
  data.tweets.forEach(tweet => {
    tweetsCached[tweet.id] = tweet;
    const article = document.createElement("article");
    article.classList.add("comment-item");

    article.innerHTML = `
      <p><strong>Usuario:</strong> ${tweet.author || "Desconocido"}</p>
      <p><strong>Tweet:</strong> ${tweet.text}</p>
      <small>ID: ${tweet.id}</small>

      <button
        class="btn-comments btn-comments--disabled"
        data-tweet-id="${tweet.id}"
        data-created-at="${Date.now()}"
        disabled
      >
        ⏳ Esperando 15:00
      </button>

      <hr>
    `;

    tweetsContainer.appendChild(article);

    const button = article.querySelector(".btn-comments");
    startCountdown(button);
  });
}

// ===============================
// Countdown 15 minutos
// ===============================
function startCountdown(button) {
  const createdAt = parseInt(button.dataset.createdAt, 10);

  const interval = setInterval(() => {
    const elapsed = Date.now() - createdAt;
    const remaining = WAIT_TIME_MS - elapsed;

    if (remaining <= 0) {
      button.disabled = false;
      button.textContent = "💬 Ver comentarios";
      button.classList.remove("btn-comments--disabled");
      button.classList.add("btn-comments--active");
      clearInterval(interval);
      return;
    }

    const min = Math.floor(remaining / 60000);
    const sec = Math.floor((remaining % 60000) / 1000);

    button.textContent = `⏳ Espera ${min}:${sec.toString().padStart(2, "0")}`;
  }, 1000);
}

// ===============================
// Click en botón (Workflow 2)
// ===============================
document.addEventListener("click", async (e) => {
  const button = e.target.closest(".btn-comments--active");
  if (!button) return;

  const tweetId = button.dataset.tweetId;
  const searchTimestamp = Number(button.dataset.createdAt);

  try {
    button.disabled = true;
    button.textContent = "⏳ Cargando comentarios...";

    const response = await fetch(
      N8N_WEBHOOK_URL2,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tweetId,
          searchTimestamp,
          requestedAt: Date.now()
        })
      }
    );

    const data = await response.json();
    console.log('Respuesta de n8n: ',data);
    

    if (!response.ok) {
      throw new Error(data.message || "Error al obtener comentarios");
    }

    renderComments(data);
    renderAISection(data, tweetId);

  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
    button.textContent = "💬 Ver comentarios";
    button.disabled = true;
  }
});

function renderComments(comments) {
  const container = document.getElementById("commentsContainer");
  // const commentsTitle = document.getElementById("commentsTitle");
  const commentsHidden = document.getElementById("commentsEmpty");
  // container.innerHTML = "";
  
  if (!comments || comments.length === 0) {
    container.innerHTML = "<p>No se enconrtaron comentarios.</p>";
    return;
  }
  commentsHidden.classList.add("hidden"); 

  comments.forEach(c => {
    const div = document.createElement("div");
    div.classList.add("comment-item");

    div.innerHTML = `
      <p><strong>@${c.author}</strong></p>
      <p>${c.text}</p>
      <small>${new Date(c.created_at).toLocaleString()}</small>
      <hr>
    `;

    container.appendChild(div);
  });
}

function renderAISection(comments, tweetId) {
  selectedTweetId = tweetId;
  const tweet = tweetsCached[tweetId];
  // Evitar duplicados
  if (document.getElementById("aiSection")) return;

  const dashboard = document.querySelector(".card--results");

  const article = document.createElement("article");
  article.id = "aiSection";
  article.classList.add("result-block");

  article.innerHTML = `
    <h3>Generar respuesta por IA</h3>
    <p>La IA utilizará los comentarios encontrados como contexto.</p>

    <button id="generateAIBtn" class="btn-primary">
      🤖 Generar respuesta por IA
    </button>
  `;

  dashboard.appendChild(article);

  const btn = article.querySelector("#generateAIBtn");

  btn.addEventListener("click", () => {
    const tweet = tweetsCached[tweetId];

    const payload = {
      type: "generate_ai_response",
      tweet: {
        id: tweet.id,
        text: tweet.text,
        author: tweet.author || "Desconocido",
        created_at: tweet.created_at
      },
      comments,
      requestedAt: new Date().toISOString()
    };
    console.log("Payload enviado a IA:", payload);
    fetch(N8N_WEBHOOK_URL3, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
})
  .then(res => res.json())
  .then(data => {
    console.log("Respuesta IA:", data);

    // 👇 AQUÍ es donde se renderiza la sección editable
    renderEditableAIResponse(data[0].output);
  })
  .catch(err => {
    console.error("Error IA:", err);
    alert("Error generando respuesta con IA");
  });
  });
}

function renderEditableAIResponse(aiText) {
  // Evitar duplicados
  if (document.getElementById("aiResponseSection")) return;

  const dashboard = document.querySelector(".card--results");

  const article = document.createElement("article");
  article.id = "aiResponseSection";
  article.classList.add("result-block");

  article.innerHTML = `
    <h3>✍️ Editar respuesta generada por IA</h3>
    <p>Puedes modificar el texto antes de enviarlo.</p>

    <textarea
      id="aiResponseTextarea"
      rows="6"
      style="width:100%;padding:10px;resize:vertical;"
    ></textarea>

    <div style="margin-top:10px;text-align:right;">
      <button id="sendEditedAIBtn" class="btn-primary">
        🚀 Enviar respuesta
      </button>
    </div>
  `;

  dashboard.appendChild(article);

  const textarea = article.querySelector("#aiResponseTextarea");
  textarea.value = aiText;

  // UX: marcar edición
  textarea.addEventListener("input", () => {
    textarea.dataset.edited = "true";
  });

  // Envío a n8n
  article
    .querySelector("#sendEditedAIBtn")
    .addEventListener("click", async () => {
      const finalText = textarea.value.trim();

      if (!finalText) {
        alert("La respuesta no puede estar vacía");
        return;
      }

      await fetch(N8N_WEBHOOK_URL4, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "publish_reply",
          tweetId: selectedTweetId,
          replyText: finalText,
          editedByUser: textarea.dataset.edited === "true",
          sentAt: new Date().toISOString()
        })
      });

      alert("Respuesta publicada en X 🚀");
    });
}
