# kde-custom-assistant

An embeddable AI assistant that opens as a chat **widget** in any web page.

It ships with a tiny Node/Express backend that proxies requests to an AI
provider (so your API key never touches the browser) and a single
self-contained `widget.js` you can drop into any site with one `<script>` tag.

## Features

- 💬 Floating chat widget (bottom-right) — no framework, no build step
- 🔌 Pluggable providers: `mock` (default, no key needed) or `openai`
- 🔒 API key stays server-side via the `/api/chat` proxy
- 🎲 Runs on a random high port (`58829`) to avoid clashing with other services

## Quick start

```bash
npm install
cp .env.example .env     # optional: add your provider/key
npm start
```

Then open http://localhost:58829/ and click the 💬 button.

The server starts with the `mock` provider by default, so it works with **no
API key**. To get real answers, edit `.env`:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

## Always-on with Docker

Run it as a persistent service that survives crashes **and host reboots**
(`restart: always`):

```bash
docker compose up -d --build
```

Manage it:

```bash
docker compose ps        # status + health
docker compose logs -f   # follow logs
docker compose restart   # restart
docker compose down      # stop and remove
```

The container exposes port **58829** and includes a healthcheck hitting
`/api/health`. Provider settings are read from the environment / a local
`.env` file (`AI_PROVIDER`, `OPENAI_API_KEY`, etc.).

> The `restart: always` policy auto-recovers the service on application
> crashes and when the Docker daemon / machine restarts. (A manual
> `docker stop`/`docker kill` is treated as an intentional stop and will not
> auto-restart until the next `docker compose up` or daemon restart.)

### Live updates (edit locally, container reloads)

The compose setup bind-mounts `./server` and `./public` into the container, so
host edits appear inside the container instantly:

- **`public/`** (widget + demo) is static — just refresh the browser.
- **`server/`** changes trigger an automatic server restart via
  **`nodemon --legacy-watch`** (polling).

> Polling is used on purpose: `node --watch` relies on inotify, which does
> **not** reliably fire for bind-mounted files under Docker + SELinux (Fedora).
> The bind mounts use the `:z` flag so SELinux relabels them for the container.

### Optional: nice hostname

Map a friendly name in `/etc/hosts` (note: hosts files can't encode a port):

```
127.0.0.1   assistant.levav.it
```

Then browse to `http://assistant.levav.it:58829/`.

To drop the `:58829` entirely, put a reverse proxy (nginx/Caddy) in front
mapping `assistant.levav.it` → `localhost:58829`.

## Embed in your own page

```html
<script
  src="http://localhost:58829/widget.js"
  data-api="http://localhost:58829/api/chat"
  data-title="My Assistant"></script>
```

| Attribute    | Description                        | Default        |
|--------------|------------------------------------|----------------|
| `data-api`   | URL of the chat proxy endpoint     | `/api/chat`    |
| `data-title` | Title shown in the widget header   | `AI Assistant` |

## Project structure

```
kde-custom-assistant/
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

## API

`POST /api/chat`

```json
{ "messages": [{ "role": "user", "content": "Hello" }] }
```

Response:

```json
{ "reply": "Hi there!" }
```

`GET /api/health` → `{ "status": "ok", "provider": "mock" }`

## License

MIT
