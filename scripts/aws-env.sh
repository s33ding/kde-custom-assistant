#!/usr/bin/env bash
# Export the host's AWS `iesb` profile credentials into .env so the
# SmoothDialogue (Bedrock) container can use them — without mounting ~/.aws.
#
# Usage:  ./scripts/aws-env.sh            # uses profile "iesb"
#         AWS_PROFILE=other ./scripts/aws-env.sh
set -euo pipefail

PROFILE="${AWS_PROFILE:-iesb}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

echo "Exporting credentials for profile '$PROFILE' into $ENV_FILE ..."

# Pull region (fallback us-east-1) and credentials from the profile.
REGION="$(aws configure get region --profile "$PROFILE" 2>/dev/null || echo us-east-1)"
CREDS="$(AWS_PROFILE="$PROFILE" aws configure export-credentials --format env-no-export 2>/dev/null)"

# Preserve any non-AWS lines already in .env.
TMP="$(mktemp)"
if [ -f "$ENV_FILE" ]; then
  grep -vE '^(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|AWS_REGION)=' "$ENV_FILE" > "$TMP" || true
fi
{
  echo "$CREDS"
  echo "AWS_REGION=$REGION"
} >> "$TMP"
mv "$TMP" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "Done. .env updated (chmod 600). Restart the stack: docker compose up -d"
