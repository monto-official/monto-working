################################################################################
# Monto AI Backend — Docker Image (Linux)
################################################################################
FROM python:3.12-slim

WORKDIR /app

# Install system deps (needed for some Python packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# SQLite DB lives in /app/data so it can be mounted as a volume
RUN mkdir -p /app/data
ENV MEMORY_DB_PATH=/app/data/monto_memory.db

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
