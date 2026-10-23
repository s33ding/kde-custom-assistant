/**
 * Sidekick widget
 * Embed with:
 *   <script src="http://localhost:58829/widget.js"
 *           data-api="http://localhost:58829/api/chat"
 *           data-title="Sidekick"></script>
 */
(function () {
  "use strict";

  const currentScript = document.currentScript;
  const API_URL =
    (currentScript && currentScript.getAttribute("data-api")) ||
    "/api/chat";
  const TITLE =
    (currentScript && currentScript.getAttribute("data-title")) ||
    "Sidekick";

  const messages = []; // {role, content}

  // ---- styles -------------------------------------------------------------
  const style = document.createElement("style");
  style.textContent = `
  .kca-launcher{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;
    background:#2563eb;color:#fff;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);
    font-size:24px;z-index:2147483000;display:flex;align-items:center;justify-content:center;transition:transform .15s;}
  .kca-launcher:hover{transform:scale(1.07);}
  .kca-panel{position:fixed;bottom:88px;right:20px;width:360px;max-width:calc(100vw - 40px);height:520px;
    max-height:calc(100vh - 120px);background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.3);
    display:none;flex-direction:column;overflow:hidden;z-index:2147483000;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}
  .kca-panel.open{display:flex;}
  .kca-header{background:#2563eb;color:#fff;padding:14px 16px;font-weight:600;display:flex;justify-content:space-between;align-items:center;}
  .kca-close{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;}
  .kca-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f8fafc;}
  .kca-msg{max-width:80%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word;}
  .kca-msg.user{align-self:flex-end;background:#2563eb;color:#fff;border-bottom-right-radius:4px;}
  .kca-msg.assistant{align-self:flex-start;background:#e2e8f0;color:#0f172a;border-bottom-left-radius:4px;}
  .kca-msg.typing{opacity:.6;font-style:italic;}
  .kca-input{display:flex;border-top:1px solid #e2e8f0;padding:10px;gap:8px;background:#fff;}
  .kca-input textarea{flex:1;resize:none;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:14px;
    font-family:inherit;max-height:90px;outline:none;}
  .kca-input textarea:focus{border-color:#2563eb;}
  .kca-send{background:#2563eb;color:#fff;border:none;border-radius:8px;padding:0 14px;cursor:pointer;font-size:14px;}
  .kca-send:disabled{opacity:.5;cursor:not-allowed;}
  `;
  document.head.appendChild(style);

  // ---- markup -------------------------------------------------------------
  const launcher = document.createElement("button");
  launcher.className = "kca-launcher";
  launcher.setAttribute("aria-label", "Open assistant");
  launcher.innerHTML = "&#128172;";

  const panel = document.createElement("div");
  panel.className = "kca-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", TITLE);
  panel.innerHTML = `
    <div class="kca-header">
      <span>${escapeHtml(TITLE)}</span>
      <button class="kca-close" aria-label="Close assistant">&times;</button>
    </div>
    <div class="kca-messages" role="log" aria-live="polite"></div>
    <form class="kca-input">
      <textarea rows="1" placeholder="Type a message..." aria-label="Message"></textarea>
      <button type="submit" class="kca-send">Send</button>
    </form>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector(".kca-messages");
  const form = panel.querySelector(".kca-input");
  const textarea = panel.querySelector("textarea");
  const sendBtn = panel.querySelector(".kca-send");
  const closeBtn = panel.querySelector(".kca-close");

  // ---- behavior -----------------------------------------------------------
  function togglePanel(open) {
    const show = open ?? !panel.classList.contains("open");
    panel.classList.toggle("open", show);
    if (show) textarea.focus();
  }

  launcher.addEventListener("click", () => togglePanel());
  closeBtn.addEventListener("click", () => togglePanel(false));

  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 90) + "px";
  });

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
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

    const typingEl = addMessage("assistant", "typing…", true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || "(no response)";
      typingEl.classList.remove("typing");
      typingEl.textContent = reply;
      messages.push({ role: "assistant", content: reply });
    } catch (err) {
      typingEl.classList.remove("typing");
      typingEl.textContent = "⚠️ Connection error. Is the server running?";
    } finally {
      setBusy(false);
      scrollToBottom();
    }
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

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // greeting
  addMessage("assistant", "Hey! 👋 I'm Sidekick. How can I help?");
})();
