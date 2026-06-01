# Stage 1: Build the frontend
FROM node:20 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup the backend and serve
FROM python:3.10-slim
WORKDIR /app/backend

# Install system dependencies that might be required by ML libraries like lightgbm or xgboost
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Install huggingface_hub for python (if not in requirements, good to have)
RUN pip install --no-cache-dir huggingface-hub

# Copy backend code
COPY backend/ ./

# Generate the data and pre-trained models natively inside the container 
# to avoid Python 3.10 vs 3.13 pickle serialization incompatibilities
RUN python data_generator.py && python amcat_mapper.py && python model_pipeline.py --source combined

# Copy built frontend to backend/static
COPY --from=frontend-builder /app/frontend/dist ./static

# Ensure data directory exists and generator can run or uses existing csv
# (The dataset is in backend/data/synthetic_students.csv)

EXPOSE 7860
ENV HOST=0.0.0.0
ENV PORT=7860
ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
