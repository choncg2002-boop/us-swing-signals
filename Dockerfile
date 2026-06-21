# Production: frontend + backend + nginx in one container (Render / VPS / Railway)
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_BASE_URL=
ENV VITE_WS_BASE_URL=
RUN npm run build

FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    RUNTIME_DIR=/data/runtime \
    PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    nginx \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/scripts ./scripts
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
COPY deploy/nginx.prod.conf.template /etc/nginx/templates/default.conf
COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8080

CMD ["/start.sh"]
