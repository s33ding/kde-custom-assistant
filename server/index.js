import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 58829;
const AI_PROVIDER = (process.env.AI_PROVIDER || "mock").toLowerCase();
const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ||
  "You are a helpful assistant embedded in a web page.";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

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

async function generateReply(messages) {
  switch (AI_PROVIDER) {
    case "openai":
      return openaiReply(messages);
    case "mock":
    default:
      return mockReply(messages);
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", provider: AI_PROVIDER });
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

app.listen(PORT, () => {
  console.log(`Sidekick running on http://localhost:${PORT}`);
  console.log(`  provider: ${AI_PROVIDER}`);
  console.log(`  demo:     http://localhost:${PORT}/`);
});
