# --- Stage 1: build the frontend ------------------------------------------------
# @leontechrepo/leon-ui is published to GitHub Packages; frontend/.npmrc reads
# LEON_UI_TOKEN. Railway exposes service variables to the build as ARGs. The
# token only exists in this stage, which is discarded: the shipped image below
# copies just the built assets, so the token is not in its layers.
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json frontend/.npmrc ./
ARG LEON_UI_TOKEN
RUN npm install
COPY frontend/ ./
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
RUN npm run build

# --- Stage 2: the API, serving the built frontend -------------------------------
FROM python:3.13-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY --from=frontend /app/frontend/dist ./frontend/dist

EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
