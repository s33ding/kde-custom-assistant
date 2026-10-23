# 💬 SmoothDialogue

A web app that rewrites informal Portuguese messages into clear, professional, and empathetic communication — powered by **AWS Bedrock** (Claude Haiku 4.5).

Built to help communicate better with work teams in Brazil.

## Features

- Rewrites text to be clear, professional, and friendly
- Adds appropriate emojis for tone
- Preserves technical terms in English
- HTTPS with locally-trusted certificates
- Dark-mode glassmorphism UI
- Keyboard-first: `Ctrl+Enter` to submit
- Desktop shortcut: `Ctrl+Shift+Alt+S`

## Tech Stack

| Layer       | Technology              |
|-------------|------------------------|
| Backend     | Python 3, Flask        |
| AI          | AWS Bedrock (Claude)   |
| Frontend    | HTML, CSS, JavaScript  |
| Proxy       | Nginx (SSL termination)|
| Runtime     | Docker Compose         |

## Quick Start

```bash
git clone https://github.com/s33ding/SmoothDialogue.git
cd SmoothDialogue
```

### 1. Generate local SSL certs

```bash
mkcert -install
mkdir -p certs
mkcert -cert-file certs/cert.pem -key-file certs/key.pem smooth.com.br smooth.com localhost 127.0.0.1
```

### 2. Create `.env`

```bash
echo "FLASK_SECRET_KEY=$(openssl rand -hex 16)" > .env
```

### 3. Add local DNS

```bash
echo "127.0.0.1   smooth.com.br" | sudo tee -a /etc/hosts
echo "127.0.0.1   smooth.com" | sudo tee -a /etc/hosts
```

### 4. Run

```bash
docker compose up --build -d
```

### 5. Access

Open **https://smooth.com.br**

## Architecture

```
Browser ──https──▶ Nginx:443 ──proxy──▶ Flask:5000 ──▶ AWS Bedrock (Claude)
                      │
                  certs/cert.pem
                  certs/key.pem
```

AWS credentials are mounted read-only from `~/.aws` using the `iesb` profile.

## Keyboard Shortcuts

| Shortcut              | Action                        |
|-----------------------|-------------------------------|
| `Ctrl+Enter`          | Submit text for improvement   |
| `Ctrl+Shift+Alt+S`   | Open app (KDE global shortcut)|

## Environment Variables

| Variable          | Default                                        | Description          |
|-------------------|------------------------------------------------|----------------------|
| `FLASK_SECRET_KEY`| `supersecretkey`                               | Flask session signing|
| `AWS_PROFILE`     | `iesb`                                         | AWS credentials      |
| `AWS_REGION`      | `us-east-1`                                    | Bedrock region       |
| `BEDROCK_MODEL_ID`| `us.anthropic.claude-haiku-4-5-20251001-v1:0`  | Model to use         |
