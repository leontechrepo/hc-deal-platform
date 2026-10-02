FROM python:3.13-slim

# Install Node.js 22
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Build frontend
# .npmrc points @leontechrepo at GitHub Packages and reads LEON_UI_TOKEN. The
# token comes in as a BuildKit secret (a Railway service variable), so it is
# never written into an image layer.
COPY frontend/package*.json frontend/.npmrc ./frontend/
RUN --mount=type=secret,id=LEON_UI_TOKEN \
    cd frontend && LEON_UI_TOKEN="$(cat /run/secrets/LEON_UI_TOKEN)" npm install

COPY frontend/ ./frontend/
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
RUN cd frontend && npm run build

# Copy rest of app
COPY . .

EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
