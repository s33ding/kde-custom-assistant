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
