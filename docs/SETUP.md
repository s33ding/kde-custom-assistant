# Sidekick — Setup & Architecture

This document registers how the whole system is wired: services, ports,
AI (AWS Bedrock), HTTPS/certificates, the local hostname, and the UI features.

## Overview

Sidekick is a small multi-tool web app plus an embeddable chat widget.

Tabs (served at `/`):

| Tab             | What it does                                   | Backend route        | AI |
|-----------------|------------------------------------------------|----------------------|----|
| **Assistant**   | In-tab chat + **voice conversation mode**      | `POST /api/chat`     | Bedrock (Claude) |
| **SmoothDialogue** | Rewrite informal PT text → professional     | `POST /api/improve`  | Bedrock (Claude) |
| **Txt Extract** | OCR: image → text (auto-loads latest screenshot)| `POST /api/img-to-text` | Bedrock (Claude vision) |

## Services (docker-compose)

```
┌──────────────┐   80/443   ┌──────────────┐   58829   ┌──────────────┐
│    Caddy     │ ─────────▶ │  assistant   │ ────────▶ │ smoothdialogue│
│ (proxy, TLS) │            │ (Node/Express)│  /chat    │ (Flask + boto3)│──▶ AWS Bedrock
└──────────────┘            └──────────────┘  /improve  └──────────────┘    (profile iesb)
                                              /ocr
```

- **assistant** — Node/Express. Serves the UI + widget, exposes `/api/*`.
  Forwards AI calls to `smooth` when `SMOOTH_API_URL` is set.
- **smooth** (SmoothDialogue) — Flask + boto3. Talks to **AWS Bedrock**.
- **proxy** — Caddy. Serves `https://s33ding.com/` (TLS) and redirects `:80`.

All three run with `restart: always` (always-on, survive reboots).

## Ports

| Port   | Service   | Notes                                  |
|--------|-----------|----------------------------------------|
| 58829  | assistant | Random high port; also direct access   |
| 80     | proxy     | Redirects to HTTPS                      |
| 443    | proxy     | `https://s33ding.com/` (mkcert TLS)     |
| 5000   | smooth    | Internal only (`expose`, not published) |

## AWS Bedrock credentials (profile `iesb`)

Credentials are **not** committed and **not** mounted from `~/.aws` (avoids
SELinux relabel of a sensitive dir). Instead they are injected as env vars via
`.env`, generated from the host profile:

```bash
./scripts/aws-env.sh          # exports profile "iesb" creds into .env (chmod 600)
docker compose up -d
```

`.env` is gitignored. Model: `us.anthropic.claude-haiku-4-5-20251001-v1:0`
(override with `BEDROCK_MODEL_ID`).

## HTTPS / certificates

HTTPS is **required** for microphone access (the Assistant's voice /
conversation mode). `s33ding.com` is local-only (`/etc/hosts`), so we use
**mkcert** to issue a locally-trusted cert.

```bash
# 1) hostname
echo "127.0.0.1   s33ding.com" | sudo tee -a /etc/hosts

# 2) install mkcert CA into system + browser trust stores, then issue the cert
sudo dnf install -y mkcert        # Fedora
mkcert -install
mkcert -cert-file certs/s33ding.crt -key-file certs/s33ding.key \
       s33ding.com localhost 127.0.0.1 ::1
```

Caddy loads `certs/s33ding.crt` + `certs/s33ding.key` (mounted read-only).
`certs/` is gitignored (contains a private key).

> After `mkcert -install`, **restart the browser** so it re-reads the trust
> store. Embedded webviews may use their own store — mkcert covers system +
> Chrome/Chromium + Firefox.

## UI features

- **Voice conversation mode** (Assistant): on by default; listens → thinks →
  speaks → repeats. Uses the browser Web Speech API (STT + TTS). Best on
  Chrome/Edge; requires HTTPS or localhost for mic.
- **Txt Extract**: auto-loads the newest image from `~/Pictures/Screenshots`
  (configurable via `SCREENSHOTS_DIR`); paste (Ctrl+V), drag, or pick to
  override.
- **Live reload**: `server/` and `public/` are bind-mounted; `server/` changes
  reload via `nodemon --legacy-watch` (polling, SELinux-safe).

### Keyboard shortcuts

| Shortcut              | Action                         |
|-----------------------|--------------------------------|
| `Alt`+`1/2/3`         | Switch tabs                    |
| `Enter`               | Send (Assistant chat)          |
| `Ctrl`+`Enter`        | Primary action (Smooth/Extract)|
| `Ctrl`+`V`            | Paste image (Txt Extract)      |
| `Ctrl`+`Shift`+`C`    | Copy result                    |

## Run it

```bash
./scripts/aws-env.sh      # inject Bedrock creds (profile iesb)
docker compose up -d --build
# https://s33ding.com/   (or http://localhost:58829/)
```
