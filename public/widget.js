/**
 * Embeddable chat widget with text + continuous voice "conversation mode".
 * Embed with:
 *   <script src="http://s33ding.com:58829/widget.js"
 *           data-api="http://s33ding.com:58829/api/chat"
 *           data-title="Assistant"
 *           data-lang="pt-BR"></script>
 */
(function () {
  "use strict";

  const currentScript = document.currentScript;
  const API_URL = (currentScript && currentScript.getAttribute("data-api")) || "/api/chat";
  const TITLE = (currentScript && currentScript.getAttribute("data-title")) || "Assistant";
  const VOICE_LANG = (currentScript && currentScript.getAttribute("data-lang")) || "pt-BR";

  const messages = []; // {role, content}

  // ---- styles (neutral monochrome) ---------------------------------------
  const style = document.createElement("style");
  style.textContent = `
  .kca-launcher{position:fixed;bottom:20px;right:20px;width:52px;height:52px;border-radius:50%;
    background:#e8e8ea;color:#09090a;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35);
    font-size:13px;font-weight:600;letter-spacing:.02em;z-index:2147483000;display:flex;align-items:center;justify-content:center;transition:transform .15s;font-family:system-ui,sans-serif;}
  .kca-launcher:hover{transform:scale(1.07);}
  .kca-panel{position:fixed;bottom:84px;right:20px;width:360px;max-width:calc(100vw - 40px);height:540px;
    max-height:calc(100vh - 120px);background:#0f0f11;color:#e8e8ea;border:1px solid #2e2e33;border-radius:14px;
    box-shadow:0 12px 40px rgba(0,0,0,.5);display:none;flex-direction:column;overflow:hidden;z-index:2147483000;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}
  .kca-panel.open{display:flex;}
  .kca-header{background:#161618;padding:13px 15px;font-weight:500;font-size:14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2e2e33;}
  .kca-head-btns{display:flex;gap:4px;align-items:center;}
  .kca-head-btn{background:none;border:none;color:#b4b4b8;font-size:13px;cursor:pointer;line-height:1;padding:5px 8px;border-radius:6px;transition:all .15s;}
  .kca-head-btn:hover{color:#e8e8ea;background:#1e1e21;}
  .kca-head-btn.active{color:#09090a;background:#e8e8ea;}
  .kca-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px;}
  .kca-msg{max-width:82%;padding:9px 12px;border-radius:12px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;}
  .kca-msg.user{align-self:flex-end;background:#e8e8ea;color:#09090a;border-bottom-right-radius:4px;}
  .kca-msg.assistant{align-self:flex-start;background:#1e1e21;color:#e8e8ea;border-bottom-left-radius:4px;}
  .kca-msg.typing{opacity:.6;font-style:italic;}
  .kca-status{display:none;padding:8px 14px;font-size:12px;color:#b4b4b8;border-top:1px solid #2e2e33;align-items:center;gap:8px;}
  .kca-status.show{display:flex;}
  .kca-orb{width:10px;height:10px;border-radius:50%;background:#78787e;}
  .kca-status.listening .kca-orb{background:#7bbfa0;animation:kca-pulse 1s infinite;}
  .kca-status.thinking .kca-orb{background:#e5e5e5;animation:kca-pulse .7s infinite;}
  .kca-status.speaking .kca-orb{background:#e8e8ea;animation:kca-pulse .5s infinite;}
  @keyframes kca-pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.4;transform:scale(1.4);}}
  .kca-input{display:flex;border-top:1px solid #2e2e33;padding:10px;gap:8px;background:#0f0f11;}
  .kca-input textarea{flex:1;resize:none;background:#161618;color:#e8e8ea;border:1px solid #2e2e33;border-radius:8px;padding:8px 10px;font-size:13.5px;font-family:inherit;max-height:90px;outline:none;}
  .kca-input textarea:focus{border-color:#78787e;}
  .kca-input textarea::placeholder{color:#78787e;}
  .kca-send{background:#e8e8ea;color:#09090a;border:none;border-radius:8px;padding:0 14px;cursor:pointer;font-size:13.5px;font-weight:500;}
  .kca-send:disabled{opacity:.5;cursor:not-allowed;}
  `;
  document.head.appendChild(style);

  // ---- markup -------------------------------------------------------------
  const launcher = document.createElement("button");
  launcher.className = "kca-launcher";
  launcher.setAttribute("aria-label", "Open assistant");
  launcher.textContent = "Chat";

  const panel = document.createElement("div");
  panel.className = "kca-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", TITLE);
  panel.innerHTML = `
    <div class="kca-header">
      <span>${escapeHtml(TITLE)}</span>
      <div class="kca-head-btns">
        <button class="kca-convo kca-head-btn" aria-label="Conversation mode" title="Modo conversa (voz)">Conversar</button>
        <button class="kca-close kca-head-btn" aria-label="Close">&times;</button>
      </div>
    </div>
    <div class="kca-messages" role="log" aria-live="polite"></div>
    <div class="kca-status"><span class="kca-orb"></span><span class="kca-status-text"></span></div>
    <form class="kca-input">
      <textarea rows="1" placeholder="Mensagem..." aria-label="Message"></textarea>
      <button type="submit" class="kca-send">Enviar</button>
    </form>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector(".kca-messages");
  const form = panel.querySelector(".kca-input");
  const textarea = panel.querySelector("textarea");
  const sendBtn = panel.querySelector(".kca-send");
  const closeBtn = panel.querySelector(".kca-close");
  const convoBtn = panel.querySelector(".kca-convo");
  const statusEl = panel.querySelector(".kca-status");
  const statusText = panel.querySelector(".kca-status-text");

  // ---- voice engines ------------------------------------------------------
  const synth = window.speechSynthesis;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let convoMode = false;   // continuous conversation loop active
  let listening = false;
  let recognition = null;

  if (SR) {
    recognition = new SR();
    recognition.lang = VOICE_LANG;
    recognition.interimResults = false;
    recognition.continuous = false;
  } else {
    convoBtn.style.display = "none"; // no speech recognition in this browser
  }

  function setStatus(state, text) {
    statusEl.className = "kca-status" + (state ? " show " + state : "");
    statusText.textContent = text || "";
  }

  function speak(text) {
    return new Promise((resolve) => {
      if (!synth) return resolve();
      try {
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = VOICE_LANG;
        u.onend = resolve;
        u.onerror = resolve;
        synth.speak(u);
      } catch (_) { resolve(); }
    });
  }

  // Listen once, resolve with the recognized transcript (or "").
  function listenOnce() {
    return new Promise((resolve) => {
      if (!recognition) return resolve("");
      let done = false;
      const finish = (val) => { if (!done) { done = true; listening = false; resolve(val); } };
      recognition.onresult = (e) => finish(e.results[0][0].transcript);
      recognition.onerror = () => finish("");
      recognition.onend = () => finish("");
      try { recognition.start(); listening = true; } catch (_) { finish(""); }
    });
  }

  // The conversation loop: listen -> send -> speak -> repeat.
  async function conversationLoop() {
    while (convoMode) {
      setStatus("listening", "Ouvindo…");
      const said = (await listenOnce()).trim();
      if (!convoMode) break;
      if (!said) { continue; } // nothing heard, listen again
      addMessage("user", said);
      messages.push({ role: "user", content: said });

      setStatus("thinking", "Pensando…");
      const reply = await requestReply();
      if (!convoMode) break;

      addMessage("assistant", reply);
      messages.push({ role: "assistant", content: reply });

      setStatus("speaking", "Falando…");
      await speak(reply);
    }
    setStatus(null, "");
  }

  function startConvo() {
    if (!recognition) return;
    convoMode = true;
    convoBtn.classList.add("active");
    convoBtn.textContent = "Parar";
    togglePanel(true);
    conversationLoop();
  }

  function stopConvo() {
    convoMode = false;
    convoBtn.classList.remove("active");
    convoBtn.textContent = "Conversar";
    if (recognition && listening) { try { recognition.stop(); } catch (_) {} }
    if (synth) synth.cancel();
    setStatus(null, "");
  }

  convoBtn.addEventListener("click", () => (convoMode ? stopConvo() : startConvo()));

  // ---- shared request -----------------------------------------------------
  async function requestReply() {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      return data.reply || data.error || "(sem resposta)";
    } catch (_) {
      return "Erro de conexão.";
    }
  }

  // ---- text mode ----------------------------------------------------------
  function togglePanel(open) {
    const show = open ?? !panel.classList.contains("open");
    panel.classList.toggle("open", show);
    if (show) textarea.focus();
    if (!show) stopConvo();
  }

  launcher.addEventListener("click", () => togglePanel());
  closeBtn.addEventListener("click", () => togglePanel(false));

  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 90) + "px";
  });
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = textarea.value.trim();
    if (!text) return;
    addMessage("user", text);
    messages.push({ role: "user", content: text });
    textarea.value = "";
    textarea.style.height = "auto";
    setBusy(true);
    const typingEl = addMessage("assistant", "…", true);
    const reply = await requestReply();
    typingEl.classList.remove("typing");
    typingEl.textContent = reply;
    messages.push({ role: "assistant", content: reply });
    setBusy(false);
    scrollToBottom();
  });

  function addMessage(role, content, typing) {
    const el = document.createElement("div");
    el.className = "kca-msg " + role + (typing ? " typing" : "");
    el.textContent = content;
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }
  function setBusy(busy) {
    sendBtn.disabled = busy;
    textarea.disabled = busy;
    if (!busy) textarea.focus();
  }
  function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  addMessage("assistant", "Oi! Como posso ajudar? Use o botão Conversar para falar por voz.");
})();
