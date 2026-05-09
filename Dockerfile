# syntax=docker/dockerfile:1.6

### node deps #########################################################
FROM node:20-slim AS node-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

### node build ########################################################
FROM node:20-slim AS node-builder
WORKDIR /app
COPY --from=node-deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

### runtime (Python + Node) ###########################################
FROM python:3.11-slim AS runner

# System deps for docling + Node.js 20
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg libgl1 libglib2.0-0 libgomp1 \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Next.js standalone output
COPY --from=node-builder /app/.next/standalone ./
COPY --from=node-builder /app/.next/static ./.next/static
COPY --from=node-builder /app/public ./public

# Python backend
COPY backend/*.py ./backend/

# Start both processes
RUN printf '#!/bin/sh\ncd /app/backend && python server.py &\nexec node /app/server.js\n' \
    > /start.sh && chmod +x /start.sh

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    FASTAPI_URL=http://localhost:8000

EXPOSE 8080
CMD ["/start.sh"]
