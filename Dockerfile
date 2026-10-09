# ---- 1. Build the React app ----
FROM node:22-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- 2. Flask API + built frontend ----
FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# WeasyPrint needs Pango; DejaVu is the font used in the letter template.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY api/ ./
COPY --from=web /web/dist /app/frontend
ENV FRONTEND_DIST=/app/frontend
RUN chmod +x start.sh
CMD ["./start.sh"]