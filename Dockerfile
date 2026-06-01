# Stage 1: Build the frontend
FROM node:18 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup the backend and serve
FROM python:3.10-slim
WORKDIR /app/backend

# Install backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install huggingface_hub for python (if not in requirements, good to have)
RUN pip install --no-cache-dir huggingface-hub

# Copy backend code
COPY backend/ ./

# Copy built frontend to backend/static
COPY --from=frontend-builder /app/frontend/dist ./static

# Ensure data directory exists and generator can run or uses existing csv
# (The dataset is in backend/data/synthetic_students.csv)

EXPOSE 7860
ENV HOST=0.0.0.0
ENV PORT=7860
ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
