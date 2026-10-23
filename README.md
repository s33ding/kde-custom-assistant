<h1 align="center">🦸 Sidekick</h1>

<p align="center">
  <em>An embeddable AI assistant that opens as a chat <strong>widget</strong> in any web page.</em>
</p>

<p align="center">
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white">
  <img alt="docker" src="https://img.shields.io/badge/docker-always--on-2496ED?logo=docker&logoColor=white">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue">
</p>

---

Sidekick is a multi-tool AI web app (plus an embeddable chat widget) powered by
**AWS Bedrock**. It runs always-on with Docker behind a Caddy HTTPS proxy.

**Three tabs** (served at `/`):

- **Assistant** — in-tab chat with a **voice conversation mode** (speak and it
  speaks back, hands-free).
- **SmoothDialogue** — rewrites informal Portuguese into clear, professional text.
- **Txt Extract** — OCR (image → text); auto-loads the latest screenshot, or
  paste/drag your own.

A self-contained `widget.js` can also embed the chat into any page with one
`<script>` tag — your API key / AWS creds never touch the browser (the backend
proxies to Bedrock).

> Full architecture, ports, AWS/Bedrock, and HTTPS/cert setup:
> see [`docs/SETUP.md`](docs/SETUP.md).

## Features

- **AI via AWS Bedrock** (Claude Haiku) — chat, text rewrite, and image OCR
- **Voice conversation mode** (Web Speech API; needs HTTPS/localhost for mic)
- **3 tabs** + keyboard shortcuts (`Alt`+`1/2/3`, `Ctrl`+`Enter`, `Ctrl`+`Shift`+`C`)
- **HTTPS** at `https://s33ding.com/` via Caddy + mkcert (local trusted cert)
- **Always-on with Docker** (`restart: always` — survives crashes & reboots)
- **Live reload** — edit locally, the container picks it up instantly
- 🎲 Runs on a **random high port** (`58829`) to avoid clashing with other apps

## 🚀 Quick start

### With Node

```bash
npm install
cp .env.example .env     # optional: add your provider/key
npm start
```

Open http://localhost:58829/ and click the 💬 button.

### With Docker (recommended — always-on)

```bash
docker compose up -d --build
```

| Command | What it does |
|---|---|
| `docker compose ps` | status + health |
| `docker compose logs -f` | follow logs (and live-reload events) |
| `docker compose restart` | restart the service |
| `docker compose down` | stop and remove |

Sidekick starts with the `mock` provider by default, so it works with **no API
key**. For real answers, edit `.env`:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

## ♻️ Live updates (edit locally, container reloads)

The compose setup bind-mounts `./server` and `./public` into the container, so
host edits apply immediately:

- **`public/`** (widget + demo) is static — just refresh the browser.
- **`server/`** changes trigger an automatic restart via
  **`nodemon --legacy-watch`** (polling).

> Polling is intentional: `node --watch` relies on inotify, which does **not**
> reliably fire for bind-mounted files under Docker + SELinux (Fedora). The
> bind mounts use the `:z` flag so SELinux relabels them for the container.

## 🌐 Nice hostname (optional)

Map a friendly name in `/etc/hosts`:

```
127.0.0.1   s33ding.com
```

The bundled Caddy reverse proxy serves:

- `http://s33ding.com/` → redirects to HTTPS
- `https://s33ding.com/` → Sidekick (TLS via Caddy's **internal CA**)

HTTPS is required for microphone access (the Assistant's voice / conversation
mode). Because `s33ding.com` is local-only, Caddy issues a locally-trusted cert
with its internal CA. To make browsers trust it without a warning, install the
CA once:

```bash
docker cp sidekick-proxy:/data/caddy/pki/authorities/local/root.crt /tmp/caddy-root.crt
sudo cp /tmp/caddy-root.crt /etc/pki/ca-trust/source/anchors/caddy-s33ding-root.crt
sudo update-ca-trust    # Fedora/RHEL; Debian: update-ca-certificates
```

> For access from other devices / the public internet you'll need a real DNS
> record (not just `/etc/hosts`); then Caddy can auto-issue a public Let's
> Encrypt cert instead of the internal CA.

## 🧩 Embed in your own page

```html
<script
  src="https://s33ding.com/widget.js"
  data-api="https://s33ding.com/api/chat"
  data-title="Sidekick"></script>
```

| Attribute    | Description                        | Default      |
|--------------|------------------------------------|--------------|
| `data-api`   | URL of the chat proxy endpoint     | `/api/chat`  |
| `data-title` | Title shown in the widget header   | `Sidekick`   |

## 🔗 API

**`POST /api/chat`**

```json
{ "messages": [{ "role": "user", "content": "Hello" }] }
```

Response:

```json
{ "reply": "Hi there!" }
```

**`GET /api/health`** → `{ "status": "ok", "provider": "mock" }`

## 📁 Project structure

```
sidekick-ai/
├── public/
│   ├── index.html   # demo page
│   └── widget.js    # self-contained embeddable widget
├── server/
│   └── index.js     # Express proxy + provider logic
├── SmoothDialogue/  # companion subproject (see below)
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

## 🤝 Companion: SmoothDialogue

Bundled under [`SmoothDialogue/`](./SmoothDialogue) is a companion app that
rewrites informal Portuguese messages into clear, professional, and empathetic
communication, powered by **AWS Bedrock** (Claude Haiku).

| | Sidekick | SmoothDialogue |
|---|---|---|
| Role | Embeddable chat widget | Text-improvement web app |
| Stack | Node / Express | Python / Flask + Nginx |
| AI | OpenAI / mock | AWS Bedrock (Claude) |
| Port | `58829` | `443` (HTTPS via Nginx) |

It runs independently — see
[`SmoothDialogue/README.md`](./SmoothDialogue/README.md) for its setup (SSL
certs, `.env`, and `docker compose up`). Its secrets (`.env`) and local certs
(`certs/`) are gitignored and are **not** tracked here.

> Source: https://github.com/s33ding/SmoothDialogue

## 📜 License

MIT © [s33ding](https://github.com/s33ding)
