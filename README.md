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

Sidekick drops a floating chat assistant into any website with a single
`<script>` tag. It ships with a tiny Node/Express backend that proxies requests
to an AI provider — so your API key **never** touches the browser — and a
single self-contained `widget.js` with no build step.

## ✨ Features

- 💬 **Floating chat widget** (bottom-right) — no framework, no bundler
- 🔌 **Pluggable providers**: `mock` (default, no key needed) or `openai`
- 🔒 **API key stays server-side** behind the `/api/chat` proxy
- 🐳 **Always-on with Docker** (`restart: always` — survives crashes & reboots)
- ♻️ **Live reload** — edit locally, the container picks it up instantly
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

Map a friendly name in `/etc/hosts` (note: hosts files can't encode a port):

```
127.0.0.1   s33ding.com
```

Then browse to `http://s33ding.com:58829/`.

> To drop the `:58829`, put a reverse proxy (nginx/Caddy) in front mapping
> `s33ding.com` → `localhost:58829`. For access from other devices / the public
> internet you'll need a real DNS record (not just `/etc/hosts`).

## 🧩 Embed in your own page

```html
<script
  src="http://s33ding.com:58829/widget.js"
  data-api="http://s33ding.com:58829/api/chat"
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
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

## 📜 License

MIT © [s33ding](https://github.com/s33ding)
