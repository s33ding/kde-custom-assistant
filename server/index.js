import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 58829;
const AI_PROVIDER = (process.env.AI_PROVIDER || "mock").toLowerCase();
const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ||
  "You are a helpful assistant embedded in a web page.";

// Directory to pull the latest screenshot from (Txt Extract default source).
const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || "";

// Optional: URL of the SmoothDialogue (Flask) service. When set, /api/improve
// forwards to it; otherwise a local mock rewrite is used.
const SMOOTH_API_URL = process.env.SMOOTH_API_URL || "";

const app = express();
app.use(cors());
app.use(express.json({ limit: "12mb" }));

// Serve the widget + demo as static files.
app.use(express.static(path.join(__dirname, "..", "public")));

/**
 * Provider: mock
 * Deterministic echo-style reply so the app runs with no API key.
 */
async function mockReply(messages) {
  const last = messages.filter((m) => m.role === "user").pop();
  const text = last ? last.content : "";
  return `🤖 (mock) You said: "${text}". Set AI_PROVIDER=openai and OPENAI_API_KEY in .env for real responses.`;
}

/**
 * Provider: openai (Chat Completions compatible)
 */
async function openaiReply(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${detail}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "(no response)";
}

/**
 * Provider: smooth — forwards the conversation to the SmoothDialogue (Flask)
 * /chat endpoint, which calls AWS Bedrock (Claude).
 */
async function smoothReply(messages) {
  const base = SMOOTH_API_URL.replace(/\/+$/, "");
  const res = await fetch(`${base}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system: SYSTEM_PROMPT }),
  });
  if (!res.ok) throw new Error(`SmoothDialogue chat error ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.detail || data.error);
  return data.reply ?? "(sem resposta)";
}

async function generateReply(messages) {
  // Prefer Bedrock (via SmoothDialogue) when configured.
  if (SMOOTH_API_URL) return smoothReply(messages);
  switch (AI_PROVIDER) {
    case "openai":
      return openaiReply(messages);
    case "mock":
    default:
      return mockReply(messages);
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", provider: AI_PROVIDER, smooth: SMOOTH_API_URL ? "configured" : "mock" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }
    const reply = await generateReply(messages);
    res.json({ reply });
  } catch (err) {
    console.error("[chat] error:", err.message);
    res.status(500).json({ error: "assistant_failed", detail: err.message });
  }
});

/**
 * Rewrite informal Portuguese text into a clear, professional, empathetic tone.
 * Forwards to the SmoothDialogue (Flask) service when SMOOTH_API_URL is set;
 * otherwise returns a deterministic mock so the tab works with no backend.
 */
async function improveText(text) {
  if (SMOOTH_API_URL) {
    const res = await fetch(SMOOTH_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `text=${encodeURIComponent(text)}`,
    });
    if (!res.ok) throw new Error(`SmoothDialogue error ${res.status}`);
    const data = await res.json();
    return data.corrected_text ?? data.reply ?? "(sem resposta)";
  }
  // mock fallback (used only when SMOOTH_API_URL is not configured)
  const trimmed = text.trim().replace(/\s+/g, " ");
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  const withPunct = /[.!?]$/.test(capitalized) ? capitalized : capitalized + ".";
  return `Olá! 😊 ${withPunct} Obrigado desde já! 🙌`;
}

app.post("/api/improve", async (req, res) => {
  try {
    const text = (req.body?.text || "").toString();
    if (!text.trim()) {
      return res.status(400).json({ error: "O texto não pode estar vazio." });
    }
    const corrected_text = await improveText(text);
    res.json({ corrected_text });
  } catch (err) {
    console.error("[improve] error:", err.message);
    res.status(500).json({ error: "improve_failed", detail: err.message });
  }
});

/**
 * Grammar/spelling/style correction (en-US or pt-BR). Forwards to the
 * SmoothDialogue (Flask) /grammar endpoint; mock fallback otherwise.
 */
async function grammarCorrect(text, lang) {
  if (SMOOTH_API_URL) {
    const base = SMOOTH_API_URL.replace(/\/+$/, "");
    const r = await fetch(`${base}/grammar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
    });
    if (!r.ok) throw new Error(`SmoothDialogue grammar error ${r.status}`);
    const data = await r.json();
    if (data.error) throw new Error(data.detail || data.error);
    return { corrected: data.corrected ?? "", notes: data.notes ?? "" };
  }
  // mock fallback: trim + capitalize, no notes
  const t = text.trim().replace(/\s+/g, " ");
  return { corrected: t.charAt(0).toUpperCase() + t.slice(1), notes: "" };
}

app.post("/api/grammar", async (req, res) => {
  try {
    const text = (req.body?.text || "").toString();
    const lang = (req.body?.lang || "en-US").toString();
    if (!text.trim()) {
      return res.status(400).json({ error: "Text cannot be empty." });
    }
    const out = await grammarCorrect(text, lang);
    res.json(out);
  } catch (err) {
    console.error("[grammar] error:", err.message);
    res.status(500).json({ error: "grammar_failed", detail: err.message });
  }
});

/**
 * Extract text from an image (OCR). Expects a data URL (base64) in `image`.
 * Prefers the SmoothDialogue (Bedrock) /ocr endpoint when SMOOTH_API_URL is
 * set; falls back to an OpenAI vision model, then a mock.
 */
async function imageToText(dataUrl) {
  // 1) SmoothDialogue (Bedrock) /ocr
  if (SMOOTH_API_URL) {
    const base = SMOOTH_API_URL.replace(/\/+$/, "");
    const r = await fetch(`${base}/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl }),
    });
    if (!r.ok) throw new Error(`SmoothDialogue OCR error ${r.status}`);
    const data = await r.json();
    if (data.error) throw new Error(data.detail || data.error);
    return data.text ?? "(sem texto)";
  }
  // 2) OpenAI vision
  if (AI_PROVIDER === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Extract all text from this image. Return only the extracted text, no commentary." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        }],
      }),
    });
    if (!r.ok) throw new Error(`OpenAI vision error ${r.status}: ${await r.text()}`);
    const data = await r.json();
    return data.choices?.[0]?.message?.content ?? "(no text found)";
  }
  // 3) mock fallback
  return "📷 OCR indisponível no modo mock.";
}

app.post("/api/img-to-text", async (req, res) => {
  try {
    const image = (req.body?.image || "").toString();
    if (!image.startsWith("data:image/")) {
      return res.status(400).json({ error: "Envie uma imagem válida (data URL)." });
    }
    const text = await imageToText(image);
    res.json({ text });
  } catch (err) {
    console.error("[img-to-text] error:", err.message);
    res.status(500).json({ error: "ocr_failed", detail: err.message });
  }
});

/**
 * Return the most recent screenshot in SCREENSHOTS_DIR as a data URL.
 * Used by the Txt Extract tab to auto-load the latest screenshot.
 */
const IMG_MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };

app.get("/api/latest-screenshot", (_req, res) => {
  try {
    if (!SCREENSHOTS_DIR || !fs.existsSync(SCREENSHOTS_DIR)) {
      return res.status(404).json({ error: "screenshots_dir_unavailable" });
    }
    const files = fs.readdirSync(SCREENSHOTS_DIR)
      .filter((f) => IMG_MIME[path.extname(f).toLowerCase()])
      .map((f) => {
        const full = path.join(SCREENSHOTS_DIR, f);
        return { full, f, mtime: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length === 0) {
      return res.status(404).json({ error: "no_screenshots" });
    }
    const latest = files[0];
    const mime = IMG_MIME[path.extname(latest.f).toLowerCase()];
    const b64 = fs.readFileSync(latest.full).toString("base64");
    res.json({ name: latest.f, image: `data:${mime};base64,${b64}` });
  } catch (err) {
    console.error("[latest-screenshot] error:", err.message);
    res.status(500).json({ error: "screenshot_failed", detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Sidekick running on http://localhost:${PORT}`);
  console.log(`  provider: ${AI_PROVIDER}`);
  console.log(`  demo:     http://localhost:${PORT}/`);
});
