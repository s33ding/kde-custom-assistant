"""
Central configuration for SmoothDialogue.

All settings live here (host, port, AWS/Bedrock, Flask) and are read from
environment variables with sensible defaults, so you can tweak behavior without
touching the application code.
"""
import os


class Config:
    # --- Server / host ---------------------------------------------------
    # Host the Flask app binds to. Behind Nginx this stays 0.0.0.0 so the
    # container is reachable; the public hostname (smooth.com.br) is handled
    # by Nginx / /etc/hosts, not by Flask.
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "5000"))
    DEBUG = os.getenv("FLASK_DEBUG", "false").lower() in ("1", "true", "yes")

    # Public hostname(s) the app is served under (informational / future use,
    # e.g. building absolute URLs). Comma-separated.
    SERVER_NAME = os.getenv("SERVER_NAME", "smooth.com.br")

    # --- Flask -----------------------------------------------------------
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "supersecretkey")

    # --- AWS / Bedrock ---------------------------------------------------
    AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
    BEDROCK_MODEL_ID = os.getenv(
        "BEDROCK_MODEL_ID",
        "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    )
