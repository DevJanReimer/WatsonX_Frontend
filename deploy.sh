#!/usr/bin/env bash
# Deploy the ISDP frontend to IBM Code Engine.
# Assumes you've already run:
#   ibmcloud login --sso
#   ibmcloud target -g <resource-group> -r <region>
#   ibmcloud ce project select --name <your-ce-project>
#   ibmcloud cr login
#
# Env vars consumed by the app (set them as secrets, NOT in the image):
#   IBM_CLOUD_API_KEY, WXO_INSTANCE_URL, WXO_AGENT_ID,
#   WXO_KNOWLEDGE_BASE_ID (optional), IAM_TOKEN_URL (optional),
#   APP_USERNAME, APP_PASSWORD, APP_SESSION_SECRET

set -euo pipefail

APP_NAME="${APP_NAME:-isdp-frontend}"
REGISTRY_NS="${REGISTRY_NS:-abarxas}"                 # IBM Container Registry namespace
IMAGE="${IMAGE:-icr.io/${REGISTRY_NS}/${APP_NAME}:latest}"
SECRET_NAME="${SECRET_NAME:-isdp-frontend-secrets}"
PORT="${PORT:-8080}"

echo "==> Building image: $IMAGE"
ibmcloud cr build --tag "$IMAGE" .

echo "==> Creating/updating Code Engine secret: $SECRET_NAME"
if ibmcloud ce secret get --name "$SECRET_NAME" > /dev/null 2>&1; then
  ibmcloud ce secret update --name "$SECRET_NAME" \
    --from-env-file .env
else
  ibmcloud ce secret create --name "$SECRET_NAME" \
    --from-env-file .env
fi

echo "==> Deploying Code Engine application: $APP_NAME"
if ibmcloud ce application get --name "$APP_NAME" > /dev/null 2>&1; then
  ibmcloud ce application update --name "$APP_NAME" \
    --image "$IMAGE" \
    --port "$PORT" \
    --env-from-secret "$SECRET_NAME" \
    --min-scale 0 --max-scale 3 \
    --cpu 0.5 --memory 1G
else
  ibmcloud ce application create --name "$APP_NAME" \
    --image "$IMAGE" \
    --port "$PORT" \
    --env-from-secret "$SECRET_NAME" \
    --min-scale 0 --max-scale 3 \
    --cpu 0.5 --memory 1G
fi

echo "==> Public URL:"
ibmcloud ce application get --name "$APP_NAME" --output url
