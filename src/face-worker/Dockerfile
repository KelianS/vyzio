FROM python:3.12-slim AS base

WORKDIR /app
COPY src/face-worker/pyproject.toml ./pyproject.toml
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir grpcio grpcio-tools numpy pillow

COPY src/face-worker/server.py ./server.py

CMD ["python", "server.py"]
